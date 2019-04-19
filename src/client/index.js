'use strict'

const pify = require('pify')
const PeerId = require('peer-id')
const PeerInfo = require('peer-info')
const {
  TelemetryClient,
  network: { connectViaPost, connectViaWs },
  utils: { hour },
} = require('kitsunet-telemetry')
const timeout = (duration) => new Promise(resolve => setTimeout(resolve, duration))
const createNode = require('./libp2p/createNode')
const createPeerConnectionTracker = require('./libp2p/peerConnectionTracker')
const discoverAndConnect = require('./libp2p/discoverAndConnect')

const DhtExperiment = require('../experiments/dht/client')

const BUILD_VERSION = String(process.env.BUILD_VERSION || 'development')
const devMode = !window.location.search.includes('prod') && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')

start().catch(console.error)

async function start () {

  const id = await pify(PeerId.create)()
  const peerInfo = await pify(PeerInfo.create)(id)
  const clientId = peerInfo.id.toB58String()
  const identity = id.toJSON()
  const primaryAddress = devMode ? `/ip4/127.0.0.1/tcp/9090/ws/p2p-webrtc-star/ipfs/${clientId}`
    : `/dns4/signaller.lab.metamask.io/tcp/443/wss/p2p-webrtc-star/ipfs/${clientId}`

  const node = await createNode({ identity, addrs: [primaryAddress] })

  // for debugging
  global.Buffer = Buffer
  global.node = node
  global.getState = getState

  // connect to 6 peers from naive discovery 
  const peerConnectionTracker = createPeerConnectionTracker({ node })
  discoverAndConnect({ node, clientId, peerConnectionTracker, count: 6 })

  // setup experiments
  const dhtExp = new DhtExperiment({ node, clientId })

  // start node
  console.log('node starting...')
  await pify(node.start).call(node)
  console.log(`node started as ${clientId}`)

  // setup telemetry
  const connection = connectViaPost({ devMode })
  const telemetry = new TelemetryClient({ clientId, connection })
  telemetry.setStateHandler(getState)
  telemetry.start()

  // render loop
  while (true) {
    render()
    await timeout(1e3)
  }

  function getState () {
    return {
      dht: dhtExp.getState(),
    }
  }

  function render() {
    const { dht } = getState()
    const { providers: { all, group1, group2, group3 } } = dht
    const content = `
    me: ${clientId} <br/>
    all: ${all.length} <br/>
    group1: ${group1.length} <br/>
    group2: ${group2.length} <br/>
    group3: ${group3.length} <br/>
    `
    document.body.innerHTML = content
  }

}
  // const options = {
  //   BUILD_VERSION,
  //   identity,
  //   libp2pAddrs,
  //   libp2pBootstrap: [
  //     // `/dns4/monkey.musteka.la/tcp/443/wss/ipfs/QmUA1Ghihi5u3gDwEDxhbu49jU42QPbvHttZFwB6b4K5oC`
  //     '/ip4/127.0.0.1/tcp/30334/ws/ipfs/QmUA1Ghihi5u3gDwEDxhbu49jU42QPbvHttZFwB6b4K5oC'
  //   ],
  //   // rpcUrl,
  //   // rpcEnableTracker,
  //   ethAddrs: [
  //     // Nanopool
  //     '0x52bc44d5378309ee2abf1539bf71de1b7d7be3b5',
  //     // Gnosis GNO
  //     '0x6810e776880c02933d47db1b9fc05908e5386b96',
  //     // Gnosis GNO whale
  //     '0x1d805bc00b8fa3c96ae6c8fa97b2fd24b19a9801'
  //   ],
  //   slicePath: [
  //     '8e99',
  //     '1372',
  //     '66cc',
  //     'd019',
  //     '0aa8',
  //     '0cc6',
  //     '06d5',
  //     '59e7'
  //   ],
  //   sliceDepth: 10,
  //   NODE_ENV: devMode ? 'dev' : 'prod'
  // }

  // console.log('kitsunet booting')
  // const kitsunet = await kitsunetFactory(options)
  // console.log('kitsunet created')

  // for debugging
  // global.Buffer = Buffer
  // global.node = kitsunet.node
  // global.kitsunet = kitsunet

  // // start it up
  // await kitsunet.start()
  // console.log('kitsunet started')

  // restart client after random time
  // const timeUntilRestart = randomFromRange(1, 2) * hour
  // await timeout(timeUntilRestart)
  // window.location.reload()
