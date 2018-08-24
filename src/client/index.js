'use strict'

// setup error reporting before anything else
const buildVersion = String(process.env.BUILD_VERSION || 'development')
console.log(`MetaMask Mesh Testing - version: ${buildVersion}`)
global.Raven.config('https://5793e1040722484d9f9a620df418a0df@sentry.io/286549', { release: buildVersion }).install()

require('events').EventEmitter.defaultMaxListeners = 15

const qs = require('qs')
const pify = require('pify')
const endOfStream = require('end-of-stream')

const { hour } = require('../util/time')
const { connectToTelemetryServerViaPost } = require('../network/telemetry')
const createLibp2pNode = require('./createNode')

const rpc = require('../rpc/rpc')
const kitsunetRpcHandler = require('../rpc/kitsunet')
const serverKitsunetRpcHandler = require('../rpc/server-kitsunet')

const createClient = require('./client')
const createKitsunet = require('./kitsunet')
const createPubsub = require('./pubsub')
const createMulticast = require('./multicast')
const createBlockTracker = require('./block-tracker')
const createEbt = require('./ebt')

const peers = []
global.peers = peers

const discoveredPeers = []
global.discoveredPeers = discoveredPeers

const clientState = {
  stats: {},
  peers: {},
  pubsub: [],
  multicast: [],
  ebt: [],
  ebtState: {},
  block: {},
  blockTrackerEnabled: false
}

global.clientState = clientState

setupClient().catch(console.error)

function randomFromRange (min, max) {
  return min + Math.random() * (max - min)
}

async function setupClient () {
  // connect to telemetry server
  const opts = qs.parse(window.location.search, { ignoreQueryPrefix: true })
  const devMode = (!opts.prod && global.location.hostname === 'localhost')

  const node = await pify(createLibp2pNode)()
  // configure libp2p client
  const peerId = node.idStr

  // const serverConnection = connectToTelemetryServerViaWs()
  const serverConnection = connectToTelemetryServerViaPost({ devMode })
  endOfStream(serverConnection, async (err) => {
    console.log('rpcConnection ended', err)
  })

  const serverRpc = rpc.createRpcClient(serverKitsunetRpcHandler(), serverConnection)
  console.log('MetaMask Mesh Testing - connected to telemetry!')
  await serverRpc.setPeerId(peerId)

  const client = createClient(serverRpc, clientState, node)

  // start libp2p node
  await pify(client.startLibp2pNode)()
  console.log(`MetaMask Mesh Testing - libp2p node started with id ${peerId}`)

  createKitsunet(client, node, clientState)
  const pubsub = createPubsub(client, node, clientState)
  const multicast = createMulticast(client, node, clientState)
  const blockTracker = createBlockTracker(node, clientState)
  const ebt = createEbt(client, node, clientState)

  rpc.createRpcServer(kitsunetRpcHandler(client, multicast, pubsub, ebt, blockTracker), serverConnection)

  // submit network state to backend on interval
  // this also keeps the connection alive
  client.submitClientStateOnInterval({ serverRpc })

  // schedule refresh every hour so everyone stays hot and fresh
  client.restartWithDelay(randomFromRange(1 * hour, 1.5 * hour))
}
