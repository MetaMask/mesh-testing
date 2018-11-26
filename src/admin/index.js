// setup error reporting before anything else
const buildVersion = String(process.env.BUILD_VERSION || 'development')
console.log(`MetaMask Mesh Testing - version: ${buildVersion}`)
Raven.config('https://5793e1040722484d9f9a620df418a0df@sentry.io/286549', { release: buildVersion }).install()

require('events').EventEmitter.defaultMaxListeners = 20

const pump = require('pump')
const qs = require('qs')
const ObservableStore = require('obs-store')
const asStream = require('obs-store/lib/asStream')
const endOfStream = require('end-of-stream')
const {
  connectToTelemetryServerViaPost,
  connectToTelemetryServerViaWs
} = require('../network/telemetry')
const startAdminApp = require('./app')
const { fromDiffs } = require('../util/jsonPatchStream')
const { createJsonParseStream } = require('../util/jsonSerializeStream')

const rpc = require('../rpc/rpc')
const baseRpcHandler = require('../rpc/base')
const serverAdminRpcHandler = require('../rpc/serverAdmin')

// useful for debugging
global.Buffer = Buffer

setupAdmin().catch(console.error)

async function setupAdmin () {
  const opts = qs.parse(window.location.search, { ignoreQueryPrefix: true })
  const devMode = (!opts.prod && global.location.hostname === 'localhost')
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
  const adminRpc = rpc.createRpcServer(baseRpcHandler(), serverConnection)
  const serverRpc = rpc.createRpcClient(serverAdminRpcHandler(), adminRpc)

  endOfStream(serverConnection, (err) => console.log('server rpcConnection disconnect', err))
  global.serverAsync = serverRpc
  global.adminRpc = adminRpc
  console.log('MetaMask Mesh Testing - connected!')

  const updateStream = await serverRpc.createNetworkUpdateStream()
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
