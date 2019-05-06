'use strict'

require('events').EventEmitter.defaultMaxListeners = 20

const express = require('express')
const cors = require('cors')
const expressWebSocket = require('express-ws')
const websocketStream = require('websocket-stream/stream')
const endOfStream = require('end-of-stream')
const hat = require('hat')
const ObservableStore = require('obs-store')
const { createHttpClientHandler } = require('http-poll-stream')

const {
  utils,
  network,
  interfaces,
  rpc
} = require('kitsunet-telemetry')

const {
  timeout,
  sec,
  min
} = utils

const { createRpc } = rpc

const { pingAllClientsOnInterval } = network

const {
  client: kitsunetRpcHandler,
  server: serverKitsunetRpcHandler,
  serverAdmin: serverAdminRpcHandler,
  base: baseRpcHandler
} = interfaces

const app = express()
// enable CORS responses
app.use(cors())
// enable websocket support
expressWebSocket(app, null, {
  perMessageDeflate: false
})

const heartBeatInterval = min
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

global.disconnectClient = disconnectClient

//
// handle client life cycle
//

pingAllClientsOnInterval({
  clients,
  disconnectClient,
  heartBeatInterval,
  pingTimeout: remoteCallTimeout
})

async function handleClient (stream, req) {
  // attempt connect
  const client = {
    isAlive: true,
    ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
    stream
  }

  endOfStream(stream, (err) => {
    console.log('client rpcConnection disconnect', err)
    disconnectClient(client)
  })

  client.rpcAsync = createRpc({
    clientInterface: serverKitsunetRpcHandler(global, client),
    serverInterface: kitsunetRpcHandler(),
    connection: stream
  })

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

global.broadcastCall = async function broadcastCall (method, args, timeoutDuration) {
  console.log(`broadcasting to ${clients.length} clients:`, method, args)
  const results = {}
  await Promise.all(
    clients.map(async (client) => {
      if (!client.peerId) return
      const response = await sendCallWithTimeout(client.rpcAsync, method, args, timeoutDuration)
      results[client.peerId] = response
    })
  )
  return results
}

global.sendCallWithTimeout = async function sendCallWithTimeout (rpc, method, args, timeoutDuration) {
  try {
    const result = await Promise.race([
      errorAfterTimeout(timeoutDuration),
      sendCall(rpc, method, args),
    ])
    return { result }
  } catch (err) {
    return { error: { message: err.message, stack: err.stack } }
  }
}

async function sendCall (rpc, method, args) {
  return callDeep(rpc, method, args)
}

async function errorAfterTimeout (duration) {
  await timeout(duration)
  throw new Error('Timeout occurred.')
}

function callDeep (obj, path, args) {
  return getDeep(obj, path).apply(obj, args)
}

function getDeep(obj, path) {
  const pathParts = path.split('.')
	let _obj = obj
	while (_obj && pathParts.length) {
		const n = path.shift()
		_obj = _obj[n]
	}
	return _obj
}