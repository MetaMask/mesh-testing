const pump = require('pump')
const qs = require('qs')
const pify = require('pify')
const pullStreamToStream = require('pull-stream-to-stream')
const endOfStream = require('end-of-stream')

const { connectToTelemetryServerViaWs, connectToTelemetryServerViaPost } = require('../network/telemetry')
const { pingClientWithTimeout } = require('../network/clientTimeout')
const multiplexRpc = require('../network/multiplexRpc')
const { sec, min, hour } = require('../util/time')
const { cbifyObj } = require('../util/cbify')
const timeout = require('../util/timeout')
const createLibp2pNode = require('./createNode')
const Stat = require('libp2p-switch/src/stats/stat')

const clientStateSubmitInterval = 15 * sec
const peerPingInterval = 1 * min
const peerPingTimeout = 20 * sec
const autoConnectAttemptInterval = 10 * sec

// custom libp2p stats
const customStats = {}
const statDirectionToEvent = {
  in: 'dataReceived',
  out: 'dataSent'
}
global.getStats = libp2pStatsToJson

const kitsunetPeers = []

const peers = []
global.peers = peers
const maxPeers = 8

const discoveredPeers = []
global.discoveredPeers = discoveredPeers
const maxDiscovered = 25

const clientState = { stats: {}, peers: {}, pubsub: [] }
global.clientState = clientState

setupClient().catch(console.error)

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
    if (serverAsync) submitNetworkState({ node, serverAsync })
  }, (err) => {
    console.log('subscribed to "kitsunet-test1"', err)
  })
  global.pubsubPublish = (message) => {
    node.pubsub.publish('kitsunet-test1', Buffer.from(message, 'utf8'), (err) => {
      console.log(`published "${message}"`, err)
    })
  }

  // record custom stats
  node._switch.observer.on('message', recordLibp2pStatsMessage)

  // connect to telemetry server
  const opts = qs.parse(window.location.search, { ignoreQueryPrefix: true })
  const devMode = (!opts.prod && location.hostname === 'localhost')
  // const serverConnection = connectToTelemetryServerViaWs()
  const serverConnection = connectToTelemetryServerViaPost({ devMode })

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
  restartWithDelay(randomFromRange(1 * hour, 1.5 * hour))
}

async function submitClientStateOnInterval({ serverAsync, node }){
  while (true) {
    await submitNetworkState({ serverAsync, node })
    await timeout(clientStateSubmitInterval)
  }
}

async function submitNetworkState({ serverAsync, node }) {
  updateClientStateWithLibp2pStats()
  await serverAsync.submitNetworkState(clientState)
}

function randomFromRange (min, max) {
  return min + Math.random() * (max - min)
}

function startLibp2pNode (node, cb) {
  node.start(() => {
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
      const peerId = peerInfo.id.toB58String()
      removeFromArray(peerInfo, peers)
      disconnectKitsunetPeer(peerId)
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

function updateClientStateForNewKitsunetPeer (peerId, value) {
  clientState.peers[peerId] = value
}

function updateClientStateForKitsunetPeer (peerId, value) {
  if (value) {
    const oldValue = clientState.peers[peerId]
    // dont update the state if the peer doesnt exist
    if (!oldValue) return
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

  // do connect
  const stream = pullStreamToStream(conn)

  // create peer obj
  const peer = { id: peerId, peerInfo, stream }
  kitsunetPeers.push(peer)
  updateClientStateForNewKitsunetPeer(peerId, { status: 'connecting' })

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
      console.log(`peer rpcConnection disconnect ${peerId}`, err.message)
      disconnectKitsunetPeer(peer.id, err)
    }
  )

  peer.rpc = rpcConnection.wrap(kistunetRpcInterfaceForPeer)
  peer.rpcAsync = pify(peer.rpc)

  console.log(`MetaMask Mesh Testing - kitsunet CONNECT ${peerId}`)
  updateClientStateForKitsunetPeer(peerId, { status: 'connected' })

  // ping until disconnected
  keepPinging(peer)
}

async function keepPinging (peer) {
  while (!!clientState.peers[peer.id]) {
    const ping = await pingClientWithTimeout({ client: peer, disconnectClient, pingTimeout: peerPingTimeout })
    updateClientStateForKitsunetPeer(peer.id, { ping })
    await timeout(peerPingInterval)
  }

  function disconnectClient (peer) {
    if (!clientState.peers[peer.id]) return
    console.log('MetaMask Mesh Testing - client failed to respond to ping', peer.id)
    disconnectKitsunetPeer(peer.id)
  }
}

function disconnectKitsunetPeer (peerId, err) {
  if (!clientState.peers[peerId]) return
  console.log(`MetaMask Mesh Testing - kitsunet peer DISCONNECT ${peerId}`, err && err.message)
  // remove from clientState
  updateClientStateForKitsunetPeer(peerId, null)
  // remove from kitsunet peers
  const kitsunetPeer = kitsunetPeers.find(peer => peer.id === peerId)
  if (!kitsunetPeer) return
  removeFromArray(kitsunetPeer, kitsunetPeers)
  kitsunetPeer.stream.destroy()
  // remove from libp2p
  hangupPeer(kitsunetPeer.peerInfo)
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

function updateClientStateWithLibp2pStats(node) {
  clientState.stats = libp2pStatsToJson()
}

function recordLibp2pStatsMessage(peerId, transport, protocol, direction, bufferLength) {
  if (!peerId) return console.log('customStats message without peer', peerId, transport, protocol, direction, bufferLength)
  const peerStats = customStats[peerId] || (customStats[peerId] = { transports: {}, protocols: {}, mystery: createStat() })
  if (transport) {
    const transportStats = peerStats.transports[transport] || (peerStats.transports[transport] = createStat())
    transportStats.push(statDirectionToEvent[direction], bufferLength)
  }
  if (protocol) {
    const protocolStats = peerStats.protocols[protocol] || (peerStats.protocols[protocol] = createStat())
    protocolStats.push(statDirectionToEvent[direction], bufferLength)
  }
  if (!protocol && !transport) {
    peerStats.mystery.push(statDirectionToEvent[direction], bufferLength)
  }
}

function libp2pStatsToJson () {
  const allStats = {}
  // each peer
  Object.keys(customStats).forEach((peerId) => {
    const peerStatsContainer = customStats[peerId]
    const peerStats = allStats[peerId] = { transports: {}, protocols: {}, mystery: statObjToJson(peerStatsContainer.mystery) }
    // each transport
    Object.keys(peerStatsContainer.transports).forEach((transport) => {
      peerStats.transports[transport] = statObjToJson(peerStatsContainer.transports[transport])
    })
    // each protocol
    Object.keys(peerStatsContainer.protocols).forEach((protocol) => {
      peerStats.protocols[protocol] = statObjToJson(peerStatsContainer.protocols[protocol])
    })
  })
  return allStats
}

function statObjToJson (statsObj) {
  return {
    snapshot: {
      dataReceived: Number.parseInt(statsObj.snapshot.dataReceived.toString()),
      dataSent: Number.parseInt(statsObj.snapshot.dataSent.toString()),
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

function createStat () {
  const stat = new Stat([ 'dataReceived', 'dataSent' ], {
    computeThrottleMaxQueueSize: 1000,
    computeThrottleTimeout: 2000,
    movingAverageIntervals: [
      60 * 1000, // 1 minute
      5 * 60 * 1000, // 5 minutes
      15 * 60 * 1000 // 15 minutes
    ],
  })
  stat.start()
  return stat
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
