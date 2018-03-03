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

const clientRpc = {
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
  instrumentNode(node)
}

function randomFromRange(min, max) {
  return min + Math.random() * (max - min)
}

function instrumentNode(node) {
  node.on('peer:discovery', (peerInfo) => {
    // console.log('node/peer:discovery', peerInfo.id.toB58String())
    // console.log('node/peer:discovery', peerInfo.multiaddrs.toArray().map(i => i.toString()))
    if (peerInfo.protocols.size) console.log('node/peer:discovery', peerInfo.protocols)
  })
  node.on('peer:connect', (peerInfo) => {
    console.log('node/peer:connect', peerInfo.id.toB58String())
    if (peerInfo.protocols.size) console.log('node/peer:discovery', peerInfo.protocols)
  })
  node.on('peer:disconnect', (peerInfo) => console.log('node/peer:disconnect', peerInfo.id.toB58String()))

  node.handle('/kitsunet/test/0.0.1', (protocol, conn) => {
    console.log('incomming kitsunet connection')
    conn.getPeerInfo((err, peerInfo) => {
      if (err) console.error(err)
      connectKitsunet(peerInfo, conn)
    })
  })

  limitPeers(node, { maxPeers: 8 })
  // autoConnectAll(node)
  autoConnectWhenLonely(node, { minPeers: 4 })

  node.start(() => {
    console.log('libp2p node started')
  })
}

async function connectKitsunet(peerInfo, conn) {
  const peerId = peerInfo.id.toB58String()
  // do connect
  const stream = pullStreamToStream(conn)
  const peer = await znode(stream, kitsunetRpc)
  peer.peerInfo = peerInfo
  console.log('kitsunet CONNECT', peerId)
  kitsunetPeers.push(peer)
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
  await peer.ping()
  const end = Date.now()
  const rtt = end - start
  return rtt
}

function autoConnectAll(node) {
  node.on('peer:discovery', (peerInfo) => {
    node.dial(peerInfo, () => console.log('did dial', peerInfo.id.toB58String()))
  })
}

function autoConnectWhenLonely(node, { minPeers }) {
  let dialing = 0
  node.on('peer:discovery', (peerInfo) => {
    if (peers.length >= minPeers || dialing >= minPeers) return
    dialing++
    node.dialProtocol(peerInfo, '/kitsunet/test/0.0.1', (err, conn) => {
      const peerId = peerInfo.id.toB58String()
      console.log('outgoing kitsunet connection', peerId)
      if (err) {
        console.log('kitsunet dial failed')
        hangupPeer(peerInfo)
      } else {
        connectKitsunet(peerInfo, conn)
      }
    })
  })
}

function limitPeers(node, { maxPeers }) {

  node.on('peer:connect', (peerInfo) => {
    peers.push(peerInfo)
    // console.log('peers:', peers.map(peerInfo => peerInfo.id.toB58String()))
    checkLimit()
  })

  node.on('peer:disconnect', (peerInfo) => {
    removeFromArray(peerInfo, peers)
    // console.log('peers:', peers.map(peerInfo => peerInfo.id.toB58String()))
  })

  function checkLimit() {
    while (peers.length > maxPeers) {
      const doomedPeerInfo = selectPeerForDisconnect()
      hangupPeer(doomedPeerInfo)
      removeFromArray(doomedPeerInfo, peers)
    }
  }

}

function hangupPeer(peerInfo) {
  const peerId = peerInfo.id.toB58String()
  node.hangUp(peerInfo, () => console.log('did hangup', peerId))
}

function selectPeerForDisconnect() {
  return peers[0]
}

function removeFromArray(item, array) {
  const index = array.indexOf(item)
  if (index === -1) return
  array.splice(index, 1)
}

function timeout(duration, value) {
  return new Promise((resolve) => setTimeout(() => resolve(value), duration))
}
