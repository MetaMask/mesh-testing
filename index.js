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

const parallel = require('async/parallel')
const reflect = require('async/reflect')

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
    console.log(`MetaMask Mesh Testing - evaling "${src}"`)
    const result = eval(src)
    console.log(`MetaMask Mesh Testing - eval result: "${result}"`)
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
  if (adminCode) console.log(`MetaMask Mesh Testing - connecting with adminCode: ${adminCode}`)
  const host = ((!opts.prod && location.hostname === 'localhost') ? 'ws://localhost:9000' : 'wss://telemetry.metamask.io')
  const ws = websocket(`${host}/${adminCode}`)
  ws.on('error', console.error)

  let server = await znode(ws, clientRpc)
  global.server = server
  console.log('MetaMask Mesh Testing - connected!')

  if (adminCode) {
    // keep connection alive
    setInterval(() => server.ping(), 10 * sec)
    // setup network graph
    setupDom({
      container: document.body,
      action: updateNetworkStateAndGraph,
    })
    await updateNetworkStateAndGraph()
  }

  // in admin mode, dont boot libp2p node
  if (adminCode) return

  // submit network state to backend on interval
  setInterval(async () => {
    const state = getNetworkState()
    await server.submitNetworkState(state)
  }, 5 * sec)

  // force refresh every hour so as to not lose nodes
  restart(hour)

  const node = await pify(createNode)()
  global.node = node

  // report libp2p id
  const peerId = node.idStr
  await server.setPeerId(peerId)

  // start node
  instrumentNode(node)

  async function updateNetworkStateAndGraph () {
    // get state
    console.log('MetaMask Mesh Testing - getting network state')
    const state = await server.getNetworkState()
    console.log('MetaMask Mesh Testing - updating graph')
    const graph = buildGraph(state.clients)
    // clear graph
    const svg = document.querySelector('svg')
    if (svg) svg.remove()
    // draw graph
    drawGraph(graph)
  }
}

function randomFromRange(min, max) {
  return min + Math.random() * (max - min)
}

const RENDEZVOUS_NODES = [
  // '/dns4/tigress.kitsunet.metamask.io/tcp/443/wss/ipfs/QmZMmjMMP9VUyBkA6zFdEGmuFRdwjsiHZ3KtxMp89i7Xwv',
  // '/dns4/viper.kitsunet.metamask.io/tcp/443/wss/ipfs/QmR6X4y3N4pHMXCPf4NaN91sk9Gwz8TvRkMebK5Fjtwgoy',
  // '/dns4/crane.kitsunet.metamask.io/tcp/443/wss/ipfs/QmSJY8gjJYArR4u3rTjANWkSLwr75dVTjnknvdfbe7uiCi',
  '/dns4/monkey.kitsunet.metamask.io/tcp/443/wss/ipfs/QmUA1Ghihi5u3gDwEDxhbu49jU42QPbvHttZFwB6b4K5oC'
]
function instrumentNode(node) {
  node.start(() => {
    console.log('MetaMask Mesh Testing - libp2p node started')
    parallel(RENDEZVOUS_NODES.map((addr) => (cb) => node.dial(addr, cb)), () => {
      node.register('/kitsunet/test/0.0.1')

      node.on('peer:discovery', (peerInfo) => {
        const peerId = peerInfo.id.toB58String()
        // console.log('MetaMask Mesh Testing - node/peer:discovery', peerInfo.id.toB58String())
        // add to discovered peers list
        if (discoveredPeers.length >= maxDiscovered) return
        const alreadyExists = discoveredPeers.find(peerInfo => peerInfo.id.toB58String() === peerId)
        if (alreadyExists) return
        discoveredPeers.push(peerInfo)
      })

      node.on('peer:connect', (peerInfo) => {
        // console.log('MetaMask Mesh Testing - node/peer:connect', peerInfo.id.toB58String())
        peers.push(peerInfo)
        // attempt to upgrage to kitsunet connection
        attemptDial(peerInfo)
      })

      node.on('peer:disconnect', (peerInfo) => {
        removeFromArray(peerInfo, peers)
      })

      node.handle('/kitsunet/test/0.0.1', (protocol, conn) => {
        console.log('MetaMask Mesh Testing - incomming kitsunet connection')
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
    console.log('MetaMask Mesh Testing - kitsunet already connected', peerId)
    return
  }
  // create peer obj
  const peer = { id: peerId, peerInfo }
  kitsunetPeers.push(peer)
  updatePeerState(peerId, { status: 'connecting' })
  // do connect
  const stream = pullStreamToStream(conn)
  peer.rpc = await znode(stream, kitsunetRpc)
  console.log('MetaMask Mesh Testing - kitsunet CONNECT', peerId)
  updatePeerState(peerId, { status: 'connected' })
  // handle disconnect
  endOfStream(stream, (err) => {
    console.log('MetaMask Mesh Testing - kitsunet peer DISCONNECT', peerId, err.message)
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
    console.log('MetaMask Mesh Testing - kitsunet random dial:', peerId)
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
    // console.log('MetaMask Mesh Testing - kitsunet already connected', peerId)
    return
  }
  // attempt connection
  try {
    // console.log('MetaMask Mesh Testing - kitsunet dial', peerId)
    const conn = await pify(node.dialProtocol).call(node, peerInfo, '/kitsunet/test/0.0.1')
    await connectKitsunet(peerInfo, conn)
  } catch (err) {
    console.log('MetaMask Mesh Testing - kitsunet dial failed:', peerId, err.message)
    // hangupPeer(peerInfo)
  }
}

function hangupPeer(peerInfo) {
  const peerId = peerInfo.id.toB58String()
  node.hangUp(peerInfo, () => {
    // console.log('MetaMask Mesh Testing - did hangup', peerId)
  })
}

function restart(timeoutDuration) {
  console.log(`MetaMask Mesh Testing - restarting in ${timeoutDuration/1000} sec...`)
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
