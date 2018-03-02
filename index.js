const websocket = require('websocket-stream')
const znode = require('znode')
const qs = require('qs')
const pify = require('pify')

const createNode = require('./createNode')

const sec = 1000
const min = 60 * sec

const RPC = {
  ping: () => 'pong',
  refresh: () => window.location.reload(),
  refreshShortDelay: () => {
    setTimeout(() => window.location.reload(), randomFromRange(5 * sec, 10 * sec))
  },
  refreshLongDelay: () => {
    setTimeout(() => window.location.reload(), randomFromRange(5 * min, 10 * min))
  },
  eval: (src) => {
    console.log(`evaling "${src}"`)
    const result = eval(src)
    console.log(`eval result: "${result}"`)
    return result
  },
}

start()
.then(console.log)
.catch(console.error)

async function start(){
  const opts = qs.parse(window.location.search, { ignoreQueryPrefix: true })
  console.log(opts)
  const adminCode = opts.admin || ''
  if (adminCode) console.log(`connecting with adminCode: ${adminCode}`)
  const host = ((!opts.prod && location.hostname === 'localhost') ? 'ws://localhost:9000' : 'wss://telemetry.metamask.io')
  const ws = websocket(`${host}/${adminCode}`)
  ws.on('error', console.error)

  let server = await znode(ws, RPC)
  global.server = server
  console.log('connected!')

  const node = await pify(createNode)()
  global.node = node
  instrumentNode(node)
}

function randomFromRange(min, max) {
  return min + Math.random() * (max - min)
}

function instrumentNode(node) {
  // node.on('peer:discovery', (peerInfo) => {
  //   // console.log('node/peer:discovery', peerInfo.id.toB58String())
  //   console.log('node/peer:discovery', peerInfo.multiaddrs.toArray().map(i => i.toString()))
  //   console.log('node/peer:discovery', peerInfo.protocols)
  // })
  node.on('peer:connect', (peerInfo) => console.log('node/peer:connect', peerInfo.id.toB58String()))
  node.on('peer:disconnect', (peerInfo) => console.log('node/peer:disconnect', peerInfo.id.toB58String()))

  node.handle('/kitsunet/test/0.0.0', (protocol, conn) => {
    console.log('kitsunet connection established')
    conn.getPeerInfo((err, peerInfo) => {
      if (err) console.error(err)
      console.log('kitsunet peer:', peerInfo.id.toB58String())
    })
  })

  limitPeers(node, { maxPeers: 8 })
  autoConnectAll(node)

  node.start(() => {
    console.log('libp2p node started')
  })
}

function autoConnectAll(node) {
  node.on('peer:discovery', (peerInfo) => {
    node.dial(peerInfo, () => console.log('did dial', peerInfo.id.toB58String()))
  })
}

function limitPeers(node, { maxPeers }) {
  const peers = []
  global.peers = peers

  node.on('peer:connect', (peerInfo) => {
    peers.push(peerInfo)
    // console.log('peers:', peers.map(peerInfo => peerInfo.id.toB58String()))
    checkLimit()
  })

  node.on('peer:disconnect', (peerInfo) => {
    removePeerFromList(peerInfo)
    // console.log('peers:', peers.map(peerInfo => peerInfo.id.toB58String()))
  })

  function checkLimit() {
    while (peers.length > maxPeers) {
      const doomedPeerInfo = selectPeerForDisconnect()
      node.hangUp(doomedPeerInfo, () => console.log('did hangup', doomedPeerInfo.id.toB58String()))
      removePeerFromList(doomedPeerInfo)
    }
  }

  function selectPeerForDisconnect() {
    return peers[0]
  }

  function removePeerFromList(peerInfo) {
    const index = peers.indexOf(peerInfo)
    if (index === -1) return
    peers.splice(index, 1)
  }
}
