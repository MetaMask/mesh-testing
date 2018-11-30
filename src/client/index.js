const kitsunetFactory = require('kitsunet')
const TelemetryClient = require('../telemetry')
const Libp2pStats = require('../libp2pStats/index')
const pify = require('pify')
const PeerId = require('peer-id')
const PeerInfo = require('peer-info')
const { hour } = require('../util/time')
const timeout = require('../util/timeout')
const randomFromRange = require('../util/randomFromRange')
const DhtExperiment = require('./dhtExperiment')

const BUILD_VERSION = String(process.env.BUILD_VERSION || 'development')

start().catch(console.error)

async function start () {
  const devMode = window.location.hostname === 'localhost' && !window.location.search.includes('prod')
  const options = {
    libp2pBootstrap: [
      // `/dns4/monkey.musteka.la/tcp/443/wss/ipfs/QmUA1Ghihi5u3gDwEDxhbu49jU42QPbvHttZFwB6b4K5oC`
      '/ip4/127.0.0.1/tcp/30334/ws/ipfs/QmUA1Ghihi5u3gDwEDxhbu49jU42QPbvHttZFwB6b4K5oC'
    ],
    // rpcUrl,
    // rpcEnableTracker,
    ethAddrs: [
      // Nanopool
      '0x52bc44d5378309ee2abf1539bf71de1b7d7be3b5',
      // Gnosis GNO
      '0x6810e776880c02933d47db1b9fc05908e5386b96',
      // Gnosis GNO whale
      '0x1d805bc00b8fa3c96ae6c8fa97b2fd24b19a9801'
    ],
    // slicePath: [
    //   '8e99',
    //   '1372',
    //   '66cc',
    //   '2711',
    //   '75b3'
    // ],
    sliceDepth: 10
    // sliceFile,
    // sliceBridge,
  }

  const id = await pify(PeerId.create)()
  const peerInfo = await pify(PeerInfo.create)(id)
  const clientId = peerInfo.id.toB58String()
  const identity = id.toJSON()
  const addrs = [
    // `/dns4/signaller.lab.metamask.io/tcp/443/wss/p2p-webrtc-star/ipfs/${clientId}`,
    `/ip4/127.0.0.1/tcp/9090/ws/p2p-webrtc-star/ipfs/${clientId}`
  ]

  console.log('kitsunet booting')
  const { providerTools, kitsunet, node } = await kitsunetFactory({ options, identity, addrs })
  const { blockTracker, sliceTracker } = providerTools
  console.log('kitsunet created')

  const libp2pStats = new Libp2pStats({ node })
  const dhtExperiment = new DhtExperiment({ node, clientId })

  // configure telemetry
  const telemetry = new TelemetryClient({
    clientId,
    devMode,
    // submitInterval: 1e3,
    getState: () => ({
      version: BUILD_VERSION,
      libp2p: libp2pStats.getState(),
      kitsunet: kitsunet.getState(),
      dht: dhtExperiment.getState()
    })
  })

  // start stats reporting services
  libp2pStats.start()
  telemetry.start()

  // for debugging
  global.Buffer = Buffer
  global.node = node
  global.telemetry = telemetry
  global.kitsunet = kitsunet
  global.providerTools = providerTools

  // log latest tracker datas
  blockTracker.on('latest', (block) => {
    console.log('blockTracker', block)
  })
  sliceTracker.on('latest', (slice) => {
    console.log('sliceTracker', slice)
  })

  // start it up
  await kitsunet.start()
  console.log('kitsunet started')
  // restart client after random time
  const timeUntilRestart = randomFromRange(1, 2) * hour
  await timeout(timeUntilRestart)
  window.location.reload()
}
