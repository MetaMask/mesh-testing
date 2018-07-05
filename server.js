const express = require('express')
const cors = require('cors')
const expressWebSocket = require('express-ws')
const websocketStream = require('websocket-stream/stream')
const znode = require('znode')
const hat = require('hat')
const ObservableStore = require('obs-store')
const createHttpClientHandler = require('./src/server/http-poll-stream')


const app = express()
app.use(cors())

const sec = 1000
const min = 60 * sec

const heartBeatInterval = 1 * min
const remoteCallTimeout = 45 * sec

const networkStore = new ObservableStore({ clients: {} })

const secret = hat(256)
console.log('secret:', secret)

expressWebSocket(app, null, {
  perMessageDeflate: false,
})

const clients = []

// report stack for unhandled promise rejections
process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
  console.error(reason)
});

//
// setup client
//

app.post('/stream/:connectionId', createHttpClientHandler({
  onNewConnection: ({ connectionStream, req }) => {
    handleClient(connectionStream, req)
  }
}))

app.ws('/', function(ws, req) {
  const stream = websocketStream(ws, {
    binary: true,
  })
  handleClient(stream, req)
})

//
// setup admin
//

app.post(`/${secret}/stream/:connectionId`, createHttpClientHandler({
  onNewConnection: ({ connectionStream, req }) => {
    handleAdmin(connectionStream, req)
  }
}))

app.ws(`/${secret}`, function(ws, req) {
  const stream = websocketStream(ws, {
    binary: true,
  })

  handleAdmin(stream, req)
})

app.listen(9000, () => {
  console.log('ws listening on 9000')
})

handlePeerTimeouts()

async function handlePeerTimeouts(){
  while (true) {
    try {
      await performPeerTimeoutCheck()
    } catch (err) {
      console.error(err)
    }
    await timeout(heartBeatInterval)
  }
}

// poll for connection status
async function performPeerTimeoutCheck() {
  // try all clients in sync
  await Promise.all(clients.map(async (client) => {
    // mark client as not responded yet
    let heardPing = false

    // race against ping response or timeout
    await Promise.race([
      // await ping response
      (async () => {
        await client.rpc.ping()
        heardPing = true
      })(),
      // disconnect peer on timeout
      (async () => {
        await timeout(remoteCallTimeout)
        if (heardPing) return
        disconnectClient(client.peerId)
      })(),
    ])
  }))
}

// clear disconnect nodes from network state
// this should happen automatically as part of the disconnect process
// but i can see that it somehow is not
setInterval(() => {
  const networkState = networkStore.getState()
  Object.keys(networkState.clients).forEach((clientId) => {
    const client = clients.find(c => c.peerId === clientId)
    if (!client) {
      console.log(`orphaned client found, cleaning up: ${clientId}`)
      delete networkState.clients[clientId]
    }
  })
  networkStore.putState(networkState)
}, 10 * sec)

function disconnectClient(clientId) {
  const index = clients.findIndex(client => client.peerId === clientId)
  console.log(`disconnecting client "${clientId}"`)
  if (index === -1) return console.log(`unable to find client "${clientId}"`)
  const client = clients[index]
  // remove peer
  clients.splice(index, 1)
  // destroy stream
  client.stream.destroy()
  // update network state
  const networkState = networkStore.getState()
  delete networkState.clients[clientId]
  networkStore.putState(networkState)
  // report current connected count
  console.log(`${clients.length} peers connected`)
}

async function handleClient(stream, req) {
  // handle disconnect
  stream.on('error', (error) => {
    console.log('client disconnected - stream end')
    // Ignore network errors like `ECONNRESET`, `EPIPE`, etc.
    if (error.errno) return
    throw error
  })

  // attempt connect
  const client = {
    isAlive: true,
    ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
    stream,
  }
  client.rpc = await znode(stream, {
    ping: async () => 'pong',
    setPeerId: (peerId) => {
      client.peerId = peerId
      // update network state
      const networkState = networkStore.getState()
      networkState.clients[peerId] = { peers: [] }
      networkStore.putState(networkState)
    },
    submitNetworkState: (peers) => {
      const peerId = client.peerId
      if (!peerId) return
      if (!clients.includes(client)) return
      // update network state
      const networkState = networkStore.getState()
      networkState.clients[peerId] = { peers }
      networkStore.putState(networkState)
    },
    disconnect: () => {
      console.log(`client "${client.peerId}" sent disconnect request`)
      disconnectClient(client.peerId)
    },
  })

  clients.push(client)
  console.log('peer connected')
  console.log(`${clients.length} peers connected`)
}

async function handleAdmin(stream, request) {

  // handle disconnect
  stream.on('error', (error) => {
    console.log('admin disconnected - stream end')
    // Ignore network errors like `ECONNRESET`, `EPIPE`, etc.
    if (error.errno) return
    throw error
  })

  // attempt connect
  const admin = await znode(stream, {
    ping: async () => 'pong',
    // server data
    getPeerCount: async () => clients.length,
    getNetworkState: async () => networkStore.getState(),
    // send to client
    sendToClient: async (clientId, method, args) => {
      console.log(`forwarding "${method}" with (${args}) to client ${clientId}`)
      const client = clients.find(c => c.peerId === clientId)
      if (!client) {
        console.log(`no client found ${clientId}`)
        // znode doesnt like undefined responses
        return 'error: missing client'
      }
      return await sendCallWithTimeout(client.rpc, method, args, remoteCallTimeout)
    },
    // broadcast
    send: async (method, args) => {
      console.log(`broadcasting "${method}" with (${args}) to ${clients.length} client(s)`)
      return await broadcastCall(method, args, remoteCallTimeout)
    },
    refresh: () => broadcastCall('refresh', [], remoteCallTimeout),
    refreshShortDelay: () => broadcastCall('refreshShortDelay', [], remoteCallTimeout),
    refreshLongDelay: () => broadcastCall('refreshLongDelay', [], remoteCallTimeout),
  })
  console.log('admin connected')

  // send network state on updates
  networkStore.subscribe(networkState => {
    admin.sendNetworkState(networkState)
  })

}

function broadcastCall(method, args, timeoutDuration) {
  console.log(`broadcasting to ${clients.length} clients:`, method, args)
  return Promise.all(clients.map((client) => sendCallWithTimeout(client.rpc, method, args, timeoutDuration)))
}

function sendCallWithTimeout(rpc, method, args, timeoutDuration) {
  return Promise.race([
    timeout(timeoutDuration, 'timeout'),
    sendCall(rpc, method, args),
  ])
}

async function sendCall(rpc, method, args) {
  let result
  try {
    result = await rpc[method].apply(rpc, args)
  } catch (err) {
    return err.message
  }
  console.log(`got result: ${result}`)
  return result
}

function timeout(timeoutDuration, value) {
  return new Promise((resolve) => setTimeout(() => resolve(value), timeoutDuration))
}
