'use strict'

// setup error reporting before anything else
const buildVersion = String(process.env.BUILD_VERSION || 'development')
console.log(`MetaMask Mesh Testing - version: ${buildVersion}`)
global.Raven.config('https://5793e1040722484d9f9a620df418a0df@sentry.io/286549', { release: buildVersion }).install()

const qs = require('qs')
const pify = require('pify')
const endOfStream = require('end-of-stream')

const { hour } = require('../util/time')
const { connectToTelemetryServerViaPost } = require('../network/telemetry')
const createLibp2pNode = require('./createNode')

const rpc = require('../rpc/rpc')
const Kitsunet = require('../rpc/kitsunet')
const ServerKitsunet = require('../rpc/server-kitsunet')

const createClient = require('./client')
const createKitsunet = require('./kitsunet')

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

let client = null
let kitsunet = null

async function setupClient () {
  // connect to telemetry server
  const opts = qs.parse(window.location.search, { ignoreQueryPrefix: true })
  const devMode = (!opts.prod && global.location.hostname === 'localhost')

  const node = await pify(createLibp2pNode)()
  // configure libp2p client
  const peerId = node.idStr

  const { kitsunetRpc, serverRpc } = await setupTelemetry(devMode, peerId, 5)
  client = createClient(serverRpc, clientState, node)

  // start libp2p node
  await pify(client.startLibp2pNode)()
  console.log(`MetaMask Mesh Testing - libp2p node started with id ${peerId}`)

  kitsunet = createKitsunet(client, node, clientState)

  // submit network state to backend on interval
  // this also keeps the connection alive
  client.submitClientStateOnInterval({ serverRpc })

  // schedule refresh every hour so everyone stays hot and fresh
  client.restartWithDelay(randomFromRange(1 * hour, 1.5 * hour))
}

async function setupTelemetry (devMode, peerId, retries) {
  // const serverConnection = connectToTelemetryServerViaWs()
  const serverConnection = connectToTelemetryServerViaPost({ devMode })
  const kitsunetRpc = rpc.createRpc(new Kitsunet(global), serverConnection)

  endOfStream(serverConnection, async (err) => {
    console.log('rpcConnection ended', err)
  })

  const serverRpc = rpc.createRpc(ServerKitsunet, serverConnection)
  console.log('MetaMask Mesh Testing - connected to telemetry!')
  await serverRpc.setPeerId(peerId)
  return {kitsunetRpc, serverRpc}
}

function randomFromRange (min, max) {
  return min + Math.random() * (max - min)
}
