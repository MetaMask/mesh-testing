const websocket = require('websocket-stream')
const pump = require('pump')
const qs = require('qs')
const pify = require('pify')
const pullStreamToStream = require('pull-stream-to-stream')
const endOfStream = require('end-of-stream')
const parallel = require('async/parallel')
const reflectAll = require('async/reflectAll')
const createHttpClientStream = require('http-poll-stream/src/client')
const ObservableStore = require('obs-store')

const createLibp2pNode = require('./createNode')
const startAdminApp = require('./src/admin/index')
// const multiplexRpc = require('multiplex-rpc')
const multiplexRpc = require('./src/util/multiplexRpc')
const { cbifyObj } = require('./src/util/cbify')

const sec = 1000
const min = 60 * sec
const hour = 60 * min

const networkStateSubmitInterval = 15 * sec
const peerPingInterval = 1 * min
const peerPingTimeout = 20 * sec
const autoConnectAttemptInterval = 10 * sec

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

function getNetworkState() {
  const results = {}
  Array.from(networkState).map(([peerId, state]) => {
    if (!state.ping) return
    results[peerId] = state.ping
  })
  return results
}
global.getNetworkState = getNetworkState


start().catch(console.error)

async function start () {
  // parse params
  const opts = qs.parse(window.location.search, { ignoreQueryPrefix: true })
  const adminCode = opts.admin || ''

  if (adminCode) {
    await setupAdmin()
  } else {
    await setupClient()
  }

  async function setupAdmin () {
    // connect to telemetry
    console.log(`MetaMask Mesh Testing - connecting with adminCode: ${adminCode}`)
    const serverConnection = connectToTelemetryServerViaWs(adminCode)
    global.serverConnection = serverConnection

    // setup admin ui app
    const store = new ObservableStore()
    startAdminApp({ store })

    // setup admin rpc
    const adminRpcImplementationForServer = cbifyObj({
      ping: async () => 'pong',
      sendNetworkState: async (networkState) => {
        store.putState(networkState)
      }
    })
    const serverRpcInterfaceForAdmin = [
      'ping',
      'getPeerCount',
      'getNetworkState',
      'sendToClient',
      'send',
      'refresh',
      'refreshShortDelay',
      'refreshLongDelay',
    ]

    const rpcConnection = multiplexRpc(adminRpcImplementationForServer)
    pump(
      serverConnection,
      rpcConnection,
      serverConnection,
      (err) => {
        console.log('server rpcConnection disconnect', err)
      }
    )
    const server = rpcConnection.wrap(serverRpcInterfaceForAdmin)
    const serverAsync = pify(server)
    global.server = server
    global.serverAsync = serverAsync
    console.log('MetaMask Mesh Testing - connected!')

    // request current network state
    console.log('MetaMask Mesh Testing - fetching network state')
    const networkState = await serverAsync.getNetworkState()
    store.putState(networkState)

    // in admin mode, we dont boot libp2p node
  }

  async function setupClient () {
    // configure libp2p client
    const node = await pify(createLibp2pNode)()
    global.node = node
    const peerId = node.idStr
    // start libp2p node
    await pify(startLibp2pNode)(node)
    console.log('MetaMask Mesh Testing - libp2p node started')

    // connect to telemetry server
    // const serverConnection = connectToTelemetryServerViaWs()
    const serverConnection = connectToTelemetryServerViaPost()

    const clientRpcImplementationForServer = cbifyObj({
      ping: async () => 'pong',
      refresh: async () => restart(),
      refreshShortDelay: async () => {
        restartWithDelay(randomFromRange(5 * sec, 10 * sec))
      },
      refreshLongDelay: async () => {
        restartWithDelay(randomFromRange(2 * min, 10 * min))
      },
      eval: async (src) => {
        console.log(`MetaMask Mesh Testing - evaling "${src}"`)
        const result = eval(src)
        console.log(`MetaMask Mesh Testing - eval result: "${result}"`)
        return result
      },
      pingAll: async () => {
        return await Promise.all(kitsunetPeers.map(pingKitsunetPeerWithTimeout))
      },
    })
    const serverRpcInterfaceForClient = [
      'ping',
      'setPeerId',
      'submitNetworkState',
      'disconnect',
    ]

    const rpcConnection = multiplexRpc(clientRpcImplementationForServer)
    endOfStream(rpcConnection, (err) => console.log('rpcConnection ended', err))
    pump(
      serverConnection,
      rpcConnection,
      serverConnection,
      (err) => {
        console.log('server rpcConnection disconnect', err)
      }
    )

    const server = rpcConnection.wrap(serverRpcInterfaceForClient)
    const serverAsync = pify(server)
    global.server = server
    global.serverAsync = serverAsync
    console.log('MetaMask Mesh Testing - connected to telemetry!')
    await serverAsync.setPeerId(peerId)

    // submit network state to backend on interval
    // this also keeps the connection alive
    submitNetworkStateOnInterval(serverAsync)

    // schedule refresh every hour so everyone stays hot and fresh
    restartWithDelay(hour)
  }

  async function submitNetworkStateOnInterval(serverAsync){
    while (true) {
      const state = getNetworkState()
      await serverAsync.submitNetworkState(state)
      await timeout(networkStateSubmitInterval)
    }
  }

  function connectToTelemetryServerViaPost(adminCode) {
    const devMode = (!opts.prod && location.hostname === 'localhost')
    // const host = (devMode ? 'ws://localhost:9000' : 'wss://telemetry.metamask.io')
    // const ws = websocket(`${host}/${adminCode}`)
    // ws.on('error', console.error)
    // return ws
    const connectionId = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)
    const host = devMode ? 'http://localhost:9000' : 'https://telemetry.metamask.io'
    const uri = adminCode ? `${host}/${adminCode}/stream/${connectionId}` : `${host}/stream/${connectionId}`
    const clientStream = createHttpClientStream({ uri })
    clientStream.on('error', console.error)
    return clientStream
  }

  function connectToTelemetryServerViaWs (adminCode) {
    const devMode = (!opts.prod && window.location.hostname === 'localhost')
    const host = (devMode ? 'ws://localhost:9000' : 'wss://telemetry.metamask.io')
    const ws = websocket(adminCode ? `${host}/${adminCode}` : `${host}`)
    ws.on('error', console.error)
    return ws
  }
}

function randomFromRange (min, max) {
  return min + Math.random() * (max - min)
}

function startLibp2pNode (node, cb) {
  node.start(() => {
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

    node.stats.on('update', () => {
      // console.dir(node.stats)
    })

    autoConnectWhenLonely(node, { minPeers: 4 })
    cb()
  })
}

function updatePeerState (peerId, value) {
  if (value) {
    const oldValue = networkState.get(peerId)
    const newValue = Object.assign({}, oldValue, value)
    networkState.set(peerId, newValue)
  } else {
    networkState.delete(peerId)
  }
}

async function connectKitsunet (peerInfo, conn) {
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

  const kitsunetRpcImplementationForPeer = cbifyObj({
    ping: async () => 'pong',
  })
  const kistunetRpcInterfaceForPeer = [
    'ping'
  ]

  const rpcConnection = multiplexRpc(kitsunetRpcImplementationForPeer)
  pump(
    stream,
    rpcConnection,
    stream,
    (err) => {
      console.log('peer rpcConnection disconnect', err.message)
    }
  )

  peer.rpc = rpcConnection.wrap(kistunetRpcInterfaceForPeer)
  peer.rpcAsync = pify(peer.rpc)

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

async function keepPinging (peer) {
  while (networkState.has(peer.id)) {
    const ping = await pingKitsunetPeer(peer)
    updatePeerState(peer.id, { ping })
    await timeout(peerPingInterval)
  }
}

function pingKitsunetPeerWithTimeout (peer) {
  return Promise.race([
    timeout(peerPingTimeout, 'timeout'),
    pingKitsunetPeer(peer)
  ])
}

async function pingKitsunetPeer(peer) {
  if (!peer.rpcAsync) return
  const start = Date.now()
  await peer.rpcAsync.ping()
  const end = Date.now()
  const rtt = end - start
  return rtt
}

function autoConnectWhenLonely (node, { minPeers }) {
  setInterval(() => {
    if (peers.length >= minPeers) return
    const peerInfo = discoveredPeers.shift()
    if (!peerInfo) return
    const peerId = peerInfo.id.toB58String()
    console.log('MetaMask Mesh Testing - kitsunet random dial:', peerId)
    attemptDial(peerInfo)
  }, autoConnectAttemptInterval)
}

async function attemptDial (peerInfo) {
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
    const conn = await pify(global.node.dialProtocol).call(global.node, peerInfo, '/kitsunet/test/0.0.1')
    console.log('MetaMask Mesh Testing - kitsunet dial success', peerId)
    await connectKitsunet(peerInfo, conn)
  } catch (err) {
    console.log('MetaMask Mesh Testing - kitsunet dial failed:', peerId, err.message)
    // hangupPeer(peerInfo)
  }
}

function hangupPeer (peerInfo) {
  // const peerId = peerInfo.id.toB58String()
  global.node.hangUp(peerInfo, () => {
    // console.log('MetaMask Mesh Testing - did hangup', peerId)
  })
}

function restartWithDelay (timeoutDuration) {
  console.log(`MetaMask Mesh Testing - restarting in ${timeoutDuration / 1000} sec...`)
  setTimeout(restart, timeoutDuration)
}

function restart () {
  console.log('restarting...')
  global.server.disconnect()
  // leave 3 sec for network activity
  setTimeout(() => window.location.reload(), 3 * sec)
}

function removeFromArray (item, array) {
  const index = array.indexOf(item)
  if (index === -1) return
  array.splice(index, 1)
}

function timeout (duration, value) {
  return new Promise((resolve) => setTimeout(() => resolve(value), duration))
}
