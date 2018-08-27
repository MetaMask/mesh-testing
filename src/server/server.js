'use strict'

require('events').EventEmitter.defaultMaxListeners = 20

const express = require('express')
const cors = require('cors')
const expressWebSocket = require('express-ws')
const websocketStream = require('websocket-stream/stream')
const endOfStream = require('end-of-stream')
const hat = require('hat')
const ObservableStore = require('obs-store')
const timeout = require('../util/timeout')
const { createHttpClientHandler } = require('http-poll-stream')
const { pingAllClientsOnInterval } = require('../network/clientTimeout')

const rpc = require('../rpc/rpc')
const kitsunetRpcHandler = require('../rpc/kitsunet')
const serverKitsunetRpcHandler = require('../rpc/server-kitsunet')
const serverAdminRpcHandler = require('../rpc/server-admin')
const baseRpcHandler = require('../rpc/base')
const { sec } = require('../util/time')

const app = express()
// enable CORS responses
app.use(cors())
// enable websocket support
expressWebSocket(app, null, {
  perMessageDeflate: false
})

const heartBeatInterval = 20 * sec
const remoteCallTimeout = 45 * sec

// network state
global.networkStore = new ObservableStore({ clients: {} })
global.clients = []

// report stack for unhandled promise rejections
process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection:', reason)
  console.error(reason)
})

process.on('uncaughtException', (err) => {
  console.log('Uncaught Exception:', err)
})

//
// setup server routes
//

// setup client

app.post('/stream/:connectionId', createHttpClientHandler({
  onNewConnection: ({ connectionStream, req }) => {
    handleClient(connectionStream, req)
  }
}))

app.ws('/', function (ws, req) {
  const stream = websocketStream(ws, {
    binary: true
  })
  handleClient(stream, req)
})

// setup admin

const secret = hat(256)
console.log('secret:', secret)

app.post(`/${secret}/stream/:connectionId`, createHttpClientHandler({
  onNewConnection: ({ connectionStream, req }) => {
    handleAdmin(connectionStream, req)
  }
}))

app.ws(`/${secret}`, function (ws, req) {
  const stream = websocketStream(ws, {
    binary: true
  })

  handleAdmin(stream, req)
})

app.listen(9000, () => {
  console.log('ws listening on 9000')
})

//
// handle client life cycle
//

pingAllClientsOnInterval({
  clients,
  disconnectClient,
  heartBeatInterval,
  pingTimeout: remoteCallTimeout
})

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

function disconnectClient (client) {
  const clientId = client.peerId
  const index = clients.indexOf(client)
  console.log(`disconnecting client "${clientId}"`)
  if (index === -1) return console.log(`client already removed "${clientId}"`)
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

async function handleClient (stream, req) {
  // handle disconnect
  // stream.on('error', (error) => {
  //   console.log('client disconnected - stream end')
  //   // Ignore network errors like `ECONNRESET`, `EPIPE`, etc.
  //   if (error.errno) return
  //   throw error
  // })

  // attempt connect
  const client = {
    isAlive: true,
    ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
    stream
  }

  endOfStream(stream, (err) => {
    console.log('client rpcConnection disconnect', err.message)
    disconnectClient(client)
  })

  const serverRpc = rpc.createRpcServer(serverKitsunetRpcHandler(global, client), stream)
  const kitsunetRpc = rpc.createRpcClient(kitsunetRpcHandler(), serverRpc)

  client.rpcAsync = kitsunetRpc
  client.serverRpc = serverRpc

  clients.push(client)
  console.log('peer connected')
  console.log(`${clients.length} peers connected`)
}

async function handleAdmin (stream, request) {
  // wrap promise-y api with cbify for multiplexRpc support

  global.adminServer = rpc.createRpcServer(
    serverAdminRpcHandler(global,
      global.clients,
      global.networkStore,
      stream),
    stream)
  global.adminRpc = global.adminServer.wrap(baseRpcHandler())
  console.log('admin connected')
}

//
// client communication
//

global.broadcastCall = function broadcastCall (method, args, timeoutDuration) {
  console.log(`broadcasting to ${clients.length} clients:`, method, args)
  return Promise.all(clients.map((client) => sendCallWithTimeout(client.rpcAsync, method, args, timeoutDuration)))
}

global.sendCallWithTimeout = function sendCallWithTimeout (rpc, method, args, timeoutDuration) {
  return Promise.race([
    timeout(timeoutDuration, 'timeout'),
    sendCall(rpc, method, args)
  ])
}

async function sendCall (rpc, method, args) {
  let result
  try {
    result = await rpc[method].apply(rpc, args)
  } catch (err) {
    return err.message
  }
  console.log(`got result: ${result}`)
  return result
}
