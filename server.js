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

//
process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
  console.error(reason)
  // application specific logging, throwing an error, or other logic here
});

//
// setup client
//

app.post('/stream/:connectionId', createHttpClientHandler({
  onNewConnection: ({ connectionStream, req }) => {
    handleClient(connectionStream, req)
    // connectionStream.pipe(process.stdout)
    // connectionStream._writable.pipe(process.stdout)
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

// poll for connection status
setInterval(() => {
  // console.log('pinging')
  // ask all clients for a ping
  clients.forEach(async (client) => {
    client.isAlive = false
    // const start = Date.now()
    await client.rpc.ping()
    // const end = Date.now()
    // const duration = end - start
    // console.log('ping took', duration)
    client.isAlive = true
  })
  // if clients haven't responded, disconnect
  setTimeout(() => {
    // console.log('culling')
    clients.slice().forEach((client) => {
      if (client.isAlive) return
      // disconnect client
      const index = clients.indexOf(client)
      if (index === -1) return
      // remove peer
      clients.splice(index, 1)
      console.log('peer disconnected')
      const peerId = client.peerId
      // update network state
      const networkState = networkStore.getState()
      delete networkState.clients[peerId]
      networkStore.updateState(networkState)
      console.log(`${clients.length} peers connected`)
    })
  }, remoteCallTimeout)
}, heartBeatInterval)

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
  }
  client.rpc = await znode(stream, {
    ping: async () => 'pong',
    setPeerId: (peerId) => {
      client.peerId = peerId
      // update network state
      const networkState = networkStore.getState()
      networkState.clients[peerId] = { peers: [] }
      networkStore.updateState(networkState)
    },
    submitNetworkState: (peers) => {
      const peerId = client.peerId
      if (!peerId) return
      // update network state
      const networkState = networkStore.getState()
      networkState.clients[peerId] = { peers }
      networkStore.updateState(networkState)
    }
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
      if (!client) return console.log(`no client found ${clientId}`)
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
