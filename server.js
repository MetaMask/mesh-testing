const express = require('express')
const expressWebSocket = require('express-ws')
const websocketStream = require('websocket-stream/stream')
const znode = require('znode')
const hat = require('hat')
const app = express()

const heartBeatInterval = 10000
const secret = hat(256)
console.log('secret:', secret)

expressWebSocket(app, null, {
  perMessageDeflate: false,
})

const clients = []

app.ws('/', function(ws, req) {
  const stream = websocketStream(ws, {
    binary: true,
  })

  handleClient(stream, req)
})

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
    await client.ping()
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
      clients.splice(clients.indexOf(client), 1)
      console.log('peer disconnected')
      console.log(`${clients.length} peers connected`)
    })
  }, heartBeatInterval * 0.8)
}, heartBeatInterval)

async function handleClient(stream, request) {

  const client = await znode(stream, {
    ping: async () => 'pong',
  })
  client.isAlive = true
  clients.push(client)
  console.log('peer connected')
  console.log(`${clients.length} peers connected`)

  stream.on('error', (error) => {
    // Ignore network errors like `ECONNRESET`, `EPIPE`, etc.
    if (error.errno) return
    throw error
  })
}

async function handleAdmin(stream, request) {

  const admin = await znode(stream, {
    ping: async () => 'pong',
    send: async (method, args) => {
      console.log(`broadcasting "${method}" with (${args}) to ${clients.length} client(s)`)
      return Promise.all(clients.map(async (client) => {
        const result = await client[method].apply(client, args)
        console.log(`got result: ${result}`)
        return result
      }))
    },
    getPeerCount: async () => clients.length
  })
  console.log('admin connected')

  stream.on('error', (error) => {
    // Ignore network errors like `ECONNRESET`, `EPIPE`, etc.
    if (error.errno) return
    throw error
  })
}
