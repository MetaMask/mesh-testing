const pump = require('pump')
const qs = require('qs')
const pify = require('pify')
const pullStreamToStream = require('pull-stream-to-stream')
const endOfStream = require('end-of-stream')

const { connectToTelemetryServerViaWs, connectToTelemetryServerViaPost } = require('../network/telemetry')
const multiplexRpc = require('../network/multiplexRpc')
const { sec, min, hour } = require('../util/time')
const { cbifyObj } = require('../util/cbify')
const timeout = require('../util/timeout')
const createLibp2pNode = require('./createNode')

const clientStateSubmitInterval = 15 * sec
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

const clientState = { stats: {}, peers: {}, pubsub: [] }
global.clientState = clientState

module.exports = setupClient


async function setupClient () {
  // configure libp2p client
  const node = await pify(createLibp2pNode)()
  global.node = node
  const peerId = node.idStr
  // start libp2p node
  await pify(startLibp2pNode)(node)
  console.log('MetaMask Mesh Testing - libp2p node started')

  // setup pubsub
  node.pubsub.subscribe('kitsunet-test1', (message) => {
    const { from, data, seqno, topicIDs } = message
    console.log(`pubsub message on "kitsunet-test1" from ${from}: ${data.toString()}`)
    // record message in client state
    clientState.pubsub.push({
      from,
      data: data.toString(),
      seqno: seqno.toString(),
      topicIDs,
    })
    // publish new data to server
    if (serverAsync) serverAsync.submitNetworkState(clientState)
  }, (err) => {
    console.log('subscribed to "kitsunet-test1"', err)
  })
  global.pubsubPublish = (message) => {
    node.pubsub.publish('kitsunet-test1', Buffer.from(message, 'utf8'), (err) => {
      console.log(`published "${message}"`, err)
    })
  }

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
  submitClientStateOnInterval({ serverAsync, node })

  // schedule refresh every hour so everyone stays hot and fresh
  restartWithDelay(hour)
}

async function submitClientStateOnInterval({ serverAsync, node }){
  while (true) {
    updateClientStateWithLibp2pStats(node)
    await serverAsync.submitNetworkState(clientState)
    await timeout(clientStateSubmitInterval)
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

    autoConnectWhenLonely(node, { minPeers: 4 })
    cb()
  })
}

function updateClientStateWithLibp2pStats(node) {
  // client global
  clientState.stats.global = libp2pStatsToJson(node.stats.global)
  // transports
  const transportStats = {}
  node.stats.transports().forEach((t) => {
    const rawTransportStats = node.stats.forTransport(t)
    transportStats[t] = libp2pStatsToJson(rawTransportStats)
  })
  clientState.stats.transports = transportStats
  // peers
  node.stats.peers().forEach((peerId) => {
    let peer = clientState.peers[peerId]
    if (!peer || peer.status !== 'connected') return
    const rawPeerStats = node.stats.forPeer(peerId)
    const peerStats = libp2pStatsToJson(rawPeerStats)
    clientState.peers[peerId].stats = peerStats
  })
}

function libp2pStatsToJson(statsObj) {
  return {
    snapshot: {
      dataReceived: statsObj.snapshot.dataReceived.toString(),
      dataSent: statsObj.snapshot.dataSent.toString(),
    },
    movingAverages: {
      dataReceived: {
        '60000': statsObj.movingAverages.dataReceived['60000'].movingAverage(),
        '300000': statsObj.movingAverages.dataReceived['300000'].movingAverage(),
        '900000': statsObj.movingAverages.dataReceived['900000'].movingAverage(),
      },
      dataSent: {
        '60000': statsObj.movingAverages.dataSent['60000'].movingAverage(),
        '300000': statsObj.movingAverages.dataSent['300000'].movingAverage(),
        '900000': statsObj.movingAverages.dataSent['900000'].movingAverage(),
      },
    }
  }
}

function updatePeerState (peerId, value) {
  if (value) {
    const oldValue = clientState.peers[peerId]
    const newValue = Object.assign({}, oldValue, value)
    clientState.peers[peerId] = newValue
  } else {
    delete clientState.peers[peerId]
  }
}

async function connectKitsunet (peerInfo, conn) {
  const peerId = peerInfo.id.toB58String()
  // check if already connected
  const alreadyConnected = !!clientState.peers[peerId]
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
  while (!!clientState.peers[peer.id]) {
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
  const alreadyConnected = !!clientState.peers[peerId]
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
