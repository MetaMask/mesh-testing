'use strict'

// setup error reporting before anything else
const buildVersion = String(process.env.BUILD_VERSION || 'development')
console.log(`MetaMask Mesh Testing - version: ${buildVersion}`)
// eslint-disable-next-line no-undef
Raven.config('https://5793e1040722484d9f9a620df418a0df@sentry.io/286549', { release: buildVersion }).install()

require('events').EventEmitter.defaultMaxListeners = 20

const pump = require('pump')
const qs = require('qs')
const ObservableStore = require('obs-store')
const asStream = require('obs-store/lib/asStream')
const endOfStream = require('end-of-stream')

const {
  network,
  utils,
  interfaces,
  rpc
} = require('kitsunet-telemetry')

const {
  connectViaPost,
  connectViaWs
} = network

const {
  fromDiffs,
  createJsonParseStream
} = utils

const {
  createRpc
} = rpc

const {
  base: baseRpcHandler,
  serverAdmin: serverAdminRpcHandler
} = interfaces

const startAdminApp = require('./app')

// useful for debugging
global.Buffer = Buffer

setupAdmin().catch(console.error)

async function setupAdmin () {
  const opts = qs.parse(window.location.search, { ignoreQueryPrefix: true })
  const devMode = (!opts.prod && (global.location.hostname === 'localhost' || global.location.hostname === '127.0.0.1'))
  const adminCode = opts.admin

  // connect to telemetry
  console.log(`MetaMask Mesh Testing - connecting with adminCode: ${adminCode}`)
  const serverConnection = connectViaPost({ devMode, adminCode })
  global.serverConnection = serverConnection

  // setup admin ui app
  const store = new ObservableStore()
  global.networkStore = store
  startAdminApp({ store })

  // setup admin rpc

  endOfStream(serverConnection, (err) => console.log('server rpcConnection disconnect', err))
  global.serverAsync = createRpc({
    clientInterface: baseRpcHandler(),
    serverInterface: serverAdminRpcHandler(),
    connection: serverConnection
  })

  console.log('MetaMask Mesh Testing - connected!')

  const updateStream = await global.serverAsync.createNetworkUpdateStream()
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
