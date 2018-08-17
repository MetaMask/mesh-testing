// setup error reporting before anything else
const buildVersion = String(process.env.BUILD_VERSION) || 'development'
console.log(`MetaMask Mesh Testing - version: ${buildVersion}`)
Raven.config('https://5793e1040722484d9f9a620df418a0df@sentry.io/286549', { release: buildVersion }).install()

const pump = require('pump')
const qs = require('qs')
const pify = require('pify')
const ObservableStore = require('obs-store')
const asStream = require('obs-store/lib/asStream')
const {
  connectToTelemetryServerViaWs,
  connectToTelemetryServerViaPost
} = require('../network/telemetry')
const startAdminApp = require('./app')
const multiplexRpc = require('../network/multiplexRpc')
const { cbifyObj } = require('../util/cbify')
const { fromDiffs } = require('../util/jsonPatchStream')
const { createJsonParseStream } = require('../util/jsonSerializeStream')

setupAdmin().catch(console.error)

async function setupAdmin () {
  const opts = qs.parse(window.location.search, { ignoreQueryPrefix: true })
  const devMode = (!opts.prod && location.hostname === 'localhost')
  const adminCode = opts.admin

  // connect to telemetry
  console.log(`MetaMask Mesh Testing - connecting with adminCode: ${adminCode}`)
  const serverConnection = connectToTelemetryServerViaWs({ devMode, adminCode })
  global.serverConnection = serverConnection

  // setup admin ui app
  const store = new ObservableStore()
  global.networkStore = store
  startAdminApp({ store })

  // setup admin rpc
  const adminRpcImplementationForServer = cbifyObj({
    ping: async () => 'pong',
  })
  const serverRpcInterfaceForAdmin = [
    'ping',
    'getPeerCount',
    'getNetworkState',
    'sendToClient',
    'send',
    'refresh',
    'refreshShortDelay',
    'refreshLongDelay',
    'createNetworkUpdateStream:s',
  ]

  const rpcConnection = multiplexRpc(adminRpcImplementationForServer)
  pump(
    serverConnection,
    rpcConnection,
    serverConnection,
    (err) => {
      console.log('server rpcConnection disconnect', err)
    }
  )
  const server = rpcConnection.wrap(serverRpcInterfaceForAdmin)
  const serverAsync = pify(server)
  global.server = server
  global.serverAsync = serverAsync
  console.log('MetaMask Mesh Testing - connected!')

  const updateStream = server.createNetworkUpdateStream()
  console.log(updateStream)
  pump(
    updateStream,
    createJsonParseStream(),
    fromDiffs(),
    asStream(store),
    (err) => {
      if (err) console.log('server diff stream broke', err)
    }
  )

  // in admin mode, we dont boot libp2p node
}
