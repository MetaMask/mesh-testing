const websocket = require('websocket-stream')
const znode = require('znode')
const qs = require('qs')
const pify = require('pify')
const pullStreamToStream = require('pull-stream-to-stream')
const endOfStream = require('end-of-stream')
const {
  setupDom,
  buildGraph,
  drawGraph,
} = require('./graph')

const createNode = require('./createNode')

const sec = 1000
const min = 60 * sec
const hour = 60 * min

const kitsunetPeers = []
global.kitsunetPeers = kitsunetPeers

const peers = []
global.peers = peers
const maxPeers = 8

const discoveredPeers = []
global.discoveredPeers = discoveredPeers
const maxDiscovered = 25

const networkState = new Map()
global.networkState = networkState

const clientRpc = {
  ping: () => 'pong',
  refresh: () => window.location.reload(),
  refreshShortDelay: () => {
    restart(randomFromRange(5 * sec, 10 * sec))
  },
  refreshLongDelay: () => {
    restart(randomFromRange(2 * min, 10 * min))
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
  getNetworkState,
}
global.clientRpc = clientRpc

function getNetworkState() {
  const results = {}
  Array.from(networkState).map(([peerId, state]) => {
    if (!state.ping) return
    results[peerId] = state.ping
  })
  return results
}
global.getNetworkState = getNetworkState

const kitsunetRpc = {
  ping: () => true,
}

start().catch(console.error)

async function start(){
  // parse params
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
    // setup network graph
    setupDom({
      container: document.body,
      action: async () => {
        // get state
        console.log('getting network state')
        const state = await server.getNetworkState()
        console.log('updating graph')
        const graph = buildGraph(state)
        // clear graph
        const svg = document.querySelector('svg')
        if (svg) svg.remove()
        // draw graph
        drawGraph(graph)
      }
    })
  }

  // in admin mode, dont boot libp2p node
  if (adminCode) return

  // force refresh every hour so as to not lose nodes
  restart(hour)

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
  node.start(() => {
    console.log('libp2p node started')
    node.dial('/ip4/10.0.0.107/tcp/3334/ws/ipfs/QmStq69aqxVCgDNJzD62ybcmn1TQmQK22zg14bhb6JVn8h', (err) => {
      if (err) throw err
      node.register('/kitsunet/test/0.0.1')

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
          if (err) return console.error(err)
          connectKitsunet(peerInfo, conn)
        })
      })

      autoConnectWhenLonely(node, { minPeers: 4 })
    })
  })
}

function updatePeerState(peerId, value) {
  if (value) {
    const oldValue = networkState.get(peerId)
    const newValue = Object.assign({}, oldValue, value)
    networkState.set(peerId, newValue)
  } else {
    networkState.delete(peerId)
  }
}

async function connectKitsunet(peerInfo, conn) {
  const peerId = peerInfo.id.toB58String()
  // check if already connected
  const alreadyConnected = networkState.has(peerId)
  if (alreadyConnected) {
    console.log('kitsunet already connected', peerId)
    return
  }
  // create peer obj
  const peer = { id: peerId, peerInfo }
  kitsunetPeers.push(peer)
  updatePeerState(peerId, { status: 'connecting' })
  // do connect
  const stream = pullStreamToStream(conn)
  peer.rpc = await znode(stream, kitsunetRpc)
  console.log('kitsunet CONNECT', peerId)
  updatePeerState(peerId, { status: 'connected' })
  // handle disconnect
  endOfStream(stream, (err) => {
    console.log('kitsunet peer DISCONNECT', peerId, err.message)
    removeFromArray(peer, kitsunetPeers)
    updatePeerState(peerId, null)
  })
  // ping until disconnected
  keepPinging(peer)
}

async function keepPinging(peer) {
  while (networkState.has(peer.id)) {
    const ping = await pingKitsunetPeer(peer)
    updatePeerState(peer.id, { ping })
    await timeout(1 * min)
  }
}

function pingKitsunetPeerWithTimeout(peer) {
  return Promise.race([
    timeout(10 * sec, 'timeout'),
    pingKitsunetPeer(peer),
  ])
}

async function pingKitsunetPeer(peer) {
  if (!peer.rpc) return
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
    if (!peerInfo) return
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
  const alreadyConnected = networkState.has(peerId)
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
    console.log('kitsunet dial failed:', peerId, err.message)
    // hangupPeer(peerInfo)
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
