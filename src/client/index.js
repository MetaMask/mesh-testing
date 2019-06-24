'use strict'

const pify = require('pify')
const PeerId = require('peer-id')
const PeerInfo = require('peer-info')
const LevelStore = require('datastore-level')
const LocalStorageDown = require('localstorage-down')
const {
  TelemetryClient,
  network: { connectViaPost, connectViaWs },
  utils: { hour, sec },
} = require('kitsunet-telemetry')
const timeout = (duration) => new Promise(resolve => setTimeout(resolve, duration))
const createNode = require('./libp2p/createNode')
const createPeerConnectionTracker = require('./libp2p/peerConnectionTracker')

const TrafficExperiment = require('../experiments/traffic/client')
const DhtExperiment = require('../experiments/dht/client')
const ErrorExperiment = require('../experiments/errors/client')
const PeersExperiment = require('../experiments/peers/client')
const DebugExperiment = require('../experiments/debug/client')
const PlatformExperiment = require('../experiments/platform/client')

const BUILD_VERSION = String(process.env.BUILD_VERSION || 'development')
const devMode = !process.browser || (
  !window.location.search.includes('prod') && 
  (window.location.hostname === 'localhost' || 
  window.location.hostname === '127.0.0.1')
)

// const persistenceMode = !!process.browser
const persistenceMode = false

start().catch(console.error)

async function start () {

  // load id from persistence if possible
  let id
  let persistedId
  if (persistenceMode) {
    const raw = localStorage.getItem('libp2p-id')
    if (raw) persistedId = JSON.parse(raw)
  }
  if (persistenceMode && persistedId) {
    id = await pify(PeerId.createFromJSON)(persistedId)
  }
  if (!id) {
    id = await pify(PeerId.create)()
    if (persistenceMode) {
      const raw = JSON.stringify(id.toJSON())
      localStorage.setItem('libp2p-id', raw)
    }
  }

  const peerInfo = await pify(PeerInfo.create)(id)
  const clientId = peerInfo.id.toB58String()
  const identity = id.toJSON()
  const primaryAddress = devMode ? 
  `/ip4/127.0.0.1/tcp/9090/ws/p2p-webrtc-star/ipfs/${clientId}`: 
  `/dns4/signaller.lab.metamask.io/tcp/443/wss/p2p-webrtc-star/ipfs/${clientId}`

  let datastore = undefined
  if (persistenceMode) {
    datastore = new LevelStore('libp2p/client', { db: LocalStorageDown })
  }

  const { node, kitsunet } = await createNode({ identity, addrs: [primaryAddress], datastore })

  // rpc interface exposed to telemetry server and admin
  const rpcInterface = {}

  // for debugging
  global.Buffer = Buffer
  global.node = node
  global.getState = getState
  global.rpcInterface = rpcInterface

  // connect to 6 peers from naive discovery 
  const peerConnectionTracker = createPeerConnectionTracker({ node })

  // setup experiments
  const trafficExp = new TrafficExperiment({ node, rpcInterface })
  const dhtExp = new DhtExperiment({ node, rpcInterface, clientId })
  const errExp = new ErrorExperiment({ node, rpcInterface, clientId })
  const peersExp = new PeersExperiment({ node, rpcInterface, peerConnectionTracker })
  const debugExp = new DebugExperiment({ rpcInterface, version: BUILD_VERSION })
  const platformExp = new PlatformExperiment({})

  // start node
  console.log('node starting...')
  // await pify(node.start).call(node)
  await kitsunet.start()
  console.log(`node started as ${clientId}`)


  // setup telemetry
  const connection = devMode ? connectViaWs({ devMode }) : connectViaPost({ devMode })
  const telemetry = new TelemetryClient({
    clientId,
    connection,
    rpcInterface,
    submitInterval: devMode ? 1 * sec : 15 * sec
  })
  telemetry.setStateHandler(getState)
  telemetry.start()

  // for node, gracefully disconnect from telemetry
  process.on('SIGINT', async () => {
    console.log('Gracefully disconnecting from server...')
    try {
      await Promise.race([
        telemetry.telemetryRpc.disconnect(),
        (async () => { await timeout(3000); throw new Error('time expired'); })(),
      ])
      console.log('disconnected gracefully :)')
    } catch (err) {
      console.log('failed to disconnect gracefully :(')
    }
    process.exit()
  })

  function getState () {
    try {
      return {
        version: BUILD_VERSION,
        dht: dhtExp.getState(),
        error: errExp.getState(),
        traffic: trafficExp.getState(),
        peers: peersExp.getState(),
        debug: debugExp.getState(),
        platform: platformExp.getState(),
      }
    } catch (err) {
      console.error('Error getting client state', err)
    }
  }

  // restart client after random time
  if (!devMode && process.browser) {
    debugExp.restartWithRandomDelay(1 * hour, 2 * hour)
  }

}
