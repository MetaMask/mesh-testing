const kitsunetFactory = require('kitsunet')
const TelemetryClient = require('../telemetry')
const Libp2pStats = require('../util/stats')
const pify = require('pify')
const PeerId = require('peer-id')
const PeerInfo = require('peer-info')
const { hour } = require('../util/time')
const timeout = require('../util/timeout')
const randomFromRange = require('../util/randomFromRange')

start().catch(console.error)

async function start() {

  const devMode = window.location.hostname === 'localhost' && !window.location.search.includes('prod')

  const options = {
    libp2pBootstrap: [],
    // rpcUrl,
    // rpcEnableTracker,
    ethAddrs: [
      // Nanopool
      '0x52bc44d5378309ee2abf1539bf71de1b7d7be3b5',
      // Gnosis GNO
      '0x6810e776880c02933d47db1b9fc05908e5386b96',
      // Gnosis GNO whale
      '0x1d805bc00b8fa3c96ae6c8fa97b2fd24b19a9801',
    ],
    // slicePath,
    sliceDepth: 10,
    // sliceFile,
    // sliceBridge,
  }

  const id = await pify(PeerId.create)()
  const peerInfo = await pify(PeerInfo.create)(id)
  const peerIdStr = peerInfo.id.toB58String()
  const identity = id.toJSON()
  const addrs = [`/dns4/signaller.lab.metamask.io/tcp/443/wss/p2p-webrtc-star/ipfs/${peerIdStr}`]

  console.log('kitsunet booting')
  const { providerTools, kitsunet, node } = await kitsunetFactory({ options, identity, addrs })
  const { blockTracker, sliceTracker } = providerTools
  console.log('kitsunet created')

  const libp2pStats = new Libp2pStats({ node })

  // configure telemetry
  const telemetry = new TelemetryClient({
    devMode,
    // submitInterval: 1e3,
    getState: () => ({
      libp2p: libp2pStats.getState(),
      kitsunet: kitsunet.getState(),
    }),
  })

  // start stats reporting services
  libp2pStats.start()
  telemetry.start()

  // for debugging
  global.Buffer = Buffer
  global.providerTools = providerTools
  global.kitsunet = kitsunet
  global.telemetry = telemetry

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
  const timeUntilRestart = randomFromRange(12, 24) * hour
  await timeout(timeUntilRestart)
  window.location.reload()

}
