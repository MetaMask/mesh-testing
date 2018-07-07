const websocket = require('websocket-stream')
const createHttpClientStream = require('http-poll-stream/src/client')

module.exports = {
  connectToTelemetryServerViaPost,
  connectToTelemetryServerViaWs,
}

function connectToTelemetryServerViaPost(opts = {}) {
  const { devMode, adminCode } = opts
  const connectionId = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)
  const host = devMode ? 'http://localhost:9000' : 'https://telemetry.lab.metamask.io'
  const uri = adminCode ? `${host}/${adminCode}/stream/${connectionId}` : `${host}/stream/${connectionId}`
  const clientStream = createHttpClientStream({ uri })
  clientStream.on('error', console.error)
  return clientStream
}

function connectToTelemetryServerViaWs (opts = {}) {
  const { devMode, adminCode } = opts
  const host = (devMode ? 'ws://localhost:9000' : 'wss://telemetry.lab.metamask.io')
  const ws = websocket(adminCode ? `${host}/${adminCode}` : `${host}`)
  ws.on('error', console.error)
  return ws
}
