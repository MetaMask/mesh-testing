const websocket = require('websocket-stream')
const znode = require('znode')
const qs = require('qs')
const pify = require('pify')
const pullStreamToStream = require('pull-stream-to-stream')
const endOfStream = require('end-of-stream')

const createNode = require('./createNode')

const sec = 1000
const min = 60 * sec

const kitsunetPeers = []
global.kitsunetPeers = kitsunetPeers

const peers = []
global.peers = peers
const maxPeers = 8

const discoveredPeers = []
global.discoveredPeers = discoveredPeers
const maxDiscovered = 25


const clientRpc = {
  ping: () => 'pong',
  refresh: () => window.location.reload(),
  refreshShortDelay: () => {
    restart(randomFromRange(5 * sec, 10 * sec))
  },
  refreshLongDelay: () => {
    restart(randomFromRange(5 * min, 10 * min))
  },
  eval: (src) => {
    console.log(`evaling "${src}"`)
    const result = eval(src)
    console.log(`eval result: "${result}"`)
    return result
  },
  pingAll: async () => {
    return await Promise.all(kitsunetPeers.map(pingKitsunetPeerWithTimeout))
  },
  getNetworkState: async () => {
    const results = {}
    await Promise.all(kitsunetPeers.map(async (peer) => {
      const peerInfo = peer.peerInfo
      const peerId = peerInfo.id.toB58String()
      const id = peerId
      const rtt = await pingKitsunetPeerWithTimeout(peer)
      results[id] = rtt
    }))
    return results
  },
}
global.clientRpc = clientRpc

const kitsunetRpc = {
  ping: () => true,
}

start().catch(console.error)

async function start(){
  const opts = qs.parse(window.location.search, { ignoreQueryPrefix: true })
  const adminCode = opts.admin || ''
  if (adminCode) console.log(`connecting with adminCode: ${adminCode}`)
  const host = ((!opts.prod && location.hostname === 'localhost') ? 'ws://localhost:9000' : 'wss://telemetry.metamask.io')
  const ws = websocket(`${host}/${adminCode}`)
  ws.on('error', console.error)

  let server = await znode(ws, clientRpc)
  global.server = server
  console.log('connected!')

  if (adminCode) {
    // keep connection alive
    setInterval(() => server.ping(), 10 * sec)
  }

  // dont boot libp2p node in admin mode
  if (adminCode) return

  const node = await pify(createNode)()
  global.node = node

  // report libp2p id
  const peerId = node.idStr
  await server.setPeerId(peerId)

  // start node
  instrumentNode(node)
}

function randomFromRange(min, max) {
  return min + Math.random() * (max - min)
}

function instrumentNode(node) {
  node.on('peer:discovery', (peerInfo) => {
    const peerId = peerInfo.id.toB58String()
    // console.log('node/peer:discovery', peerInfo.id.toB58String())
    // add to discovered peers list
    if (discoveredPeers.length >= maxDiscovered) return
    const alreadyExists = discoveredPeers.find(peerInfo => peerInfo.id.toB58String() === peerId)
    if (alreadyExists) return
    discoveredPeers.push(peerInfo)
  })
  node.on('peer:connect', (peerInfo) => {
    // console.log('node/peer:connect', peerInfo.id.toB58String())
    peers.push(peerInfo)
    // attempt to upgrage to kitsunet connection
    attemptDial(peerInfo)
  })

  node.on('peer:disconnect', (peerInfo) => {
    removeFromArray(peerInfo, peers)
  })

  node.handle('/kitsunet/test/0.0.1', (protocol, conn) => {
    console.log('incomming kitsunet connection')
    conn.getPeerInfo((err, peerInfo) => {
      if (err) console.error(err)
      connectKitsunet(peerInfo, conn)
    })
  })

  autoConnectWhenLonely(node, { minPeers: 4 })

  node.start(() => {
    console.log('libp2p node started')
  })
}

async function connectKitsunet(peerInfo, conn) {
  const peerId = peerInfo.id.toB58String()
  // check if already connected
  const alreadyConnected = kitsunetPeers.find(peer => peer.peerInfo.id.toB58String() === peerId)
  if (alreadyConnected) {
    console.log('kitsunet already connected', peerId)
    return
  }
  // do connect
  const peer = { peerInfo }
  kitsunetPeers.push(peer)
  const stream = pullStreamToStream(conn)
  peer.rpc = await znode(stream, kitsunetRpc)
  console.log('kitsunet CONNECT', peerId)
  // handle disconnect
  endOfStream(stream, (err) => {
    console.log('kitsunet peer DISCONNECT', peerId, err.message)
    removeFromArray(peer, kitsunetPeers)
  })
  // ping peer as sanity check
  const rtt = await pingKitsunetPeer(peer)
  console.log('kitsunet PING OK', peerId, rtt)
}

function pingKitsunetPeerWithTimeout(peer) {
  return Promise.race([
    timeout(5 * sec, 'timeout'),
    pingKitsunetPeer(peer),
  ])
}

async function pingKitsunetPeer(peer) {
  const start = Date.now()
  await peer.rpc.ping()
  const end = Date.now()
  const rtt = end - start
  return rtt
}

function autoConnectWhenLonely(node, { minPeers }) {
  setInterval(() => {
    if (peers.length >= minPeers) return
    const peerInfo = discoveredPeers.shift()
    const peerId = peerInfo.id.toB58String()
    console.log('kitsunet random dial:', peerId)
    attemptDial(peerInfo)
  }, 10 * sec)
}

async function attemptDial(peerInfo) {
  const peerId = peerInfo.id.toB58String()
  // too many peers
  if (peers.length > maxPeers) {
    hangupPeer(peerInfo)
  }
  // check if already connected
  const alreadyConnected = kitsunetPeers.find(peer => peer.peerInfo.id.toB58String() === peerId)
  if (alreadyConnected) {
    // console.log('kitsunet already connected', peerId)
    return
  }
  // attempt connection
  try {
    // console.log('kitsunet dial', peerId)
    const conn = await pify(node.dialProtocol).call(node, peerInfo, '/kitsunet/test/0.0.1')
    await connectKitsunet(peerInfo, conn)
  } catch (err) {
    // console.log('kitsunet dial failed:', peerId, err.message)
    hangupPeer(peerInfo)
  }
}

function hangupPeer(peerInfo) {
  const peerId = peerInfo.id.toB58String()
  node.hangUp(peerInfo, () => {
    // console.log('did hangup', peerId)
  })
}

function restart(timeoutDuration) {
  console.log(`restarting in ${timeoutDuration/1000} sec...`)
  setTimeout(() => window.location.reload(), timeoutDuration)
}

function removeFromArray(item, array) {
  const index = array.indexOf(item)
  if (index === -1) return
  array.splice(index, 1)
}

function timeout(duration, value) {
  return new Promise((resolve) => setTimeout(() => resolve(value), duration))
}
