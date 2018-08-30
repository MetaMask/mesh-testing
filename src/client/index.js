'use strict'

// setup error reporting before anything else
const buildVersion = String(process.env.BUILD_VERSION || 'development')
console.log(`MetaMask Mesh Testing - version: ${buildVersion}`)
global.Raven.config('https://5793e1040722484d9f9a620df418a0df@sentry.io/286549',
  { release: buildVersion })
  .install()

require('events').EventEmitter.defaultMaxListeners = 20

const qs = require('qs')
const pify = require('pify')
const endOfStream = require('end-of-stream')

const { hour, sec } = require('../util/time')
const { connectToTelemetryServerViaPost } = require('../network/telemetry')
const createLibp2pNode = require('./libp2p/createNode')

const pingWithTimeout = require('../network/pingWithTimeout')
const timeout = require('../util/timeout')

const rpc = require('../rpc/rpc')
const kitsunetRpcMethods = require('../rpc/clientKitsunet')
const telemetryRpcMethods = require('../rpc/serverKitsunet')

const createClient = require('./client')
const createKitsunet = require('./kitsunet')
const createPubsub = require('./pubsub')
const createMulticast = require('./multicast')
const createBlockTracker = require('./block-tracker')
const createEbt = require('./ebt')
const createStats = require('./stats')

const telemetryPingTimeout = sec * 80
const heartBeatInterval = telemetryPingTimeout * 2

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

  const stats = createStats(node, clientState)
  const client = createClient(clientState, node, stats)

  // start libp2p node
  await pify(client.startLibp2pNode)()
  console.log(`MetaMask Mesh Testing - libp2p node started with id ${peerId}`)
  const { pubsub, multicast, blockTracker, ebt } = await setupComponents(client, node, clientState)

  async function bootup () {
    const serverConn = connectToTelemetryServerViaPost({ devMode })
    console.log('MetaMask Mesh Testing - connected to telemetry!')

    endOfStream(serverConn, async (err) => {
      console.log('rpcConnection ended', err)
    })

    const telemetryRpc = await setupRpc({ client, pubsub, multicast, blockTracker, ebt, serverConn })
    client.setTelemetryRpc(telemetryRpc)
    telemetryRpc.setPeerId(peerId)

    // submit network state to backend on interval
    // this also keeps the connection alive
    client.submitClientStateOnInterval()

    return telemetryRpc
  }

  const telemetryRpc = await bootup()

  // schedule refresh every hour so everyone stays hot and fresh
  client.restartWithDelay(randomFromRange(1 * hour, 1.5 * hour))

  // reconect on timeout
  while (true) {
    try {
      await pingWithTimeout(telemetryRpc, telemetryPingTimeout)
    } catch (err) {
      await bootup()
    }
    await timeout(heartBeatInterval)
  }
}

function setupRpc ({ client, multicast, pubsub, ebt, blockTracker, serverConn }) {
  const kitsunetRpc = rpc.createRpcServer(kitsunetRpcMethods(client,
    multicast,
    pubsub,
    ebt,
    blockTracker),
  serverConn)
  const telemetryRpc = rpc.createRpcClient(telemetryRpcMethods(), kitsunetRpc)
  return telemetryRpc
}

function setupComponents (client, node, clientState) {
  createKitsunet(client, node, clientState)
  const pubsub = createPubsub(client, node, clientState)
  const multicast = createMulticast(client, node, clientState)
  const blockTracker = createBlockTracker(node, clientState)
  const ebt = createEbt(client, node, clientState)

  return { pubsub, multicast, blockTracker, ebt }
}
