const pump = require('pump')
const qs = require('qs')
const pify = require('pify')
const ObservableStore = require('obs-store')

const { connectToTelemetryServerViaWs, connectToTelemetryServerViaPost } = require('../network/telemetry')
const startAdminApp = require('./app')
const multiplexRpc = require('../network/multiplexRpc')
const { cbifyObj } = require('../util/cbify')


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
    sendNetworkState: async (networkState) => {
      store.putState(networkState)
    }
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

  // request current network state
  console.log('MetaMask Mesh Testing - fetching network state')
  const networkState = await serverAsync.getNetworkState()
  store.putState(networkState)

  // in admin mode, we dont boot libp2p node
}
