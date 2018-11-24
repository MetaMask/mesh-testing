const kitsunetFactory = require('kitsunet')
const createTelemetry = require('kitsunet/src/telemetry')
const pify = require('pify')
const PeerId = require('peer-id')
const PeerInfo = require('peer-info')

start().catch(console.error)

async function start() {

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
  const { providerTools, kitsunet } = await kitsunetFactory({ options, identity, addrs })
  const { blockTracker, sliceTracker } = providerTools
  console.log('kitsunet created')

  // manually configure telemetry
  const devMode = false
  const { telemetry } = await createTelemetry({
    node: kitsunet._node,
    kitsunetPeer: kitsunet._kitsunetPeer,
    devMode,
    // submitInterval: 1e3,
  })
  kitsunet._telemetry = telemetry

  // for debugging
  global.Buffer = Buffer
  global.providerTools = providerTools
  global.kitsunet = kitsunet
  global.telemetry = telemetry

  blockTracker.on('latest', (block) => {
    console.log('blockTracker', block)
  })
  sliceTracker.on('latest', (slice) => {
    console.log('sliceTracker', slice)
  })

  // start it up

  await kitsunet.start()
  console.log('kitsunet started')

}
