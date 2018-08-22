'use strict'

// setup error reporting before anything else
const buildVersion = String(process.env.BUILD_VERSION || 'development')
console.log(`MetaMask Mesh Testing - version: ${buildVersion}`)
Raven.config('https://5793e1040722484d9f9a620df418a0df@sentry.io/286549', { release: buildVersion }).install()

const pump = require('pump')
const qs = require('qs')
const pify = require('pify')
const pullStreamToStream = require('pull-stream-to-stream')
const endOfStream = require('end-of-stream')
const createMulticast = require('libp2p-multicast-experiment/src/api')
const EBT = require('epidemic-broadcast-trees')
const toPull = require('push-stream-to-pull-stream')
const pull = require('pull-stream')

const {
  connectToTelemetryServerViaWs,
  connectToTelemetryServerViaPost
} = require('../network/telemetry')
const { pingClientWithTimeout } = require('../network/clientTimeout')
const multiplexRpc = require('../network/multiplexRpc')
const { sec, min, hour } = require('../util/time')
const { cbifyObj } = require('../util/cbify')
const timeout = require('../util/timeout')
const createLibp2pNode = require('./createNode')
const Stat = require('libp2p-switch/src/stats/stat')
const blockHeaderFromRpc = require('ethereumjs-block/header-from-rpc')
const createEthProvider = require('../eth-provider')
const hexUtils = require('../eth-provider/hex-utils')

const createEbt = require('./ebt')

const rpc = require('../rpc/rpc')
const Kitsunet = require('../rpc/kitsunet')
const ServerKitsunet = require('../rpc/server-kitsunet')

const clientStateSubmitInterval = 15 * sec
const peerPingInterval = 1 * min
const peerPingTimeout = 20 * sec
const autoConnectAttemptInterval = 10 * sec

// custom libp2p stats
const libp2pPeerStats = {}
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

const clientState = {
  stats: {},
  peers: {},
  pubsub: [],
  multicast: [],
  ebt: [],
  ebtState: {},
  block: {},
  blockTrackerEnabled: false
}

global.clientState = clientState

setupClient().catch(console.error)

const blocks = new Map()

async function setupClient () {
  // configure libp2p client
  const node = await pify(createLibp2pNode)()
  global.node = node
  const peerId = node.idStr
  // start libp2p node
  await pify(startLibp2pNode)(node)
  console.log(`MetaMask Mesh Testing - libp2p node started with id ${peerId}`)

  global.ebt = createEbt(peerId)
  global.ebt.request(peerId, true)
  global.ebtCreateStream = () => toPull(global.ebt.createStream(peerId))

  global.ebtAppend = (msg) => {
    global.ebt.append(msg, (err) => {
      if (err) {
        console.error(err)
        return
      }
      clientState.ebtState = msg
      if (serverAsync) submitNetworkState({ node, serverAsync })
    })
  }

  setInterval(() => {
    // console.dir(global.ebt)
    clientState.ebt = Array
      .from(new Set(Object.values(global.ebt.store).reduce(
        (accumulator, currentValue) => accumulator.concat(currentValue),
        []
      ).map((m) => m.content)))
  }, 1000)

  global.pubsubPublish = (message) => {
    node.pubsub.publish('kitsunet-test1', Buffer.from(message, 'utf8'), (err) => {
      console.log(`pubsub published "${message}"`, err)
    })
  }

  global.multicastPublish = (message, hops) => {
    node.multicast.publish('kitsunet-test2', Buffer.from(message, 'utf8'), hops, (err) => {
      console.log(`multicast published "${message}"`, err)
    })
  }

  global.multicast.addFrwdHooks('block-header', [(peer, msg) => {
    let block = null
    try {
      block = JSON.parse(msg.data.toString())
    } catch (err) {
      console.error(err)
      return false
    }

    if (!block) { return false }
    const peerBlocs = blocks.has(peer.info.id.toB58String()) || new Set()
    if (peerBlocs.has(block.number)) {
      console.log(`skipping block ${block.number}`)
      return false
    }
    peerBlocs.add(block.number)
    return true
  }])

  global.blockPublish = (blockHeader) => {
    node.multicast.publish('block-header', blockHeader, -1, (err) => {
      if (err) {
        console.error(err)
      }
    })
  }

  global.ethProvider = createEthProvider({ rpcUrl: 'https://mainnet.infura.io/' })
  const trackerCb = (blockNumber) => {
    // add to ipfs
    console.log(`latest block is: ${Number(blockNumber)}`)
    const cleanHex = hexUtils.formatHex(blockNumber)
    global.ethProvider.ethQuery.getBlockByNumber(cleanHex, false, (err, block) => {
      if (err) {
        console.error(err)
        return
      }
      global.blockPublish(Buffer.from(JSON.stringify(block)))
    })
  }

  global.enableBlockTracker = (enabled) => {
    clientState.blockTrackerEnabled = enabled
    if (clientState.blockTrackerEnabled) {
      // setup block storage
      global.ethProvider.blockTracker.on('latest', trackerCb)
    } else {
      global.ethProvider.blockTracker.removeListener('latest', trackerCb)
    }
  }

  // record custom stats
  node._switch.observer.on('message', recordLibp2pStatsMessage)

  // connect to telemetry server
  const opts = qs.parse(window.location.search, { ignoreQueryPrefix: true })
  const devMode = (!opts.prod && location.hostname === 'localhost')

  await setupTelemetry(devMode, peerId, 5)

  // submit network state to backend on interval
  // this also keeps the connection alive
  submitClientStateOnInterval({ serverAsync, node })

  // schedule refresh every hour so everyone stays hot and fresh
  restartWithDelay(randomFromRange(1 * hour, 1.5 * hour))
}

async function setupTelemetry (devMode, peerId, retries) {
  // const serverConnection = connectToTelemetryServerViaWs()
  const serverConnection = connectToTelemetryServerViaPost({ devMode })
  const kitsunetRpc = rpc.createRpc(new Kitsunet(global), serverConnection)

  endOfStream(serverConnection, async (err) => {
    console.log('rpcConnection ended', err)
  })

  const serverRpc = rpc.createRpc(ServerKitsunet, serverConnection)
  global.server = serverRpc
  global.serverAsync = serverRpc
  global.kitsinetRpc = kitsunetRpc
  console.log('MetaMask Mesh Testing - connected to telemetry!')
  await serverRpc.setPeerId(peerId)
}

async function submitClientStateOnInterval ({ serverAsync, node }) {
  while (true) {
    await submitNetworkState({ serverAsync, node })
    await timeout(clientStateSubmitInterval)
  }
}

async function submitNetworkState ({ serverAsync, node }) {
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
      const peerId = peerInfo.id.toB58String()
      updateClientStateForLibp2pPeerConnect(peerId)
      // console.log('MetaMask Mesh Testing - node/peer:connect', peerInfo.id.toB58String())
      peers.push(peerInfo)
      // attempt to upgrage to kitsunet connection
      attemptDial(peerInfo)
      attemptDialEbt(peerInfo)
    })

    node.on('peer:disconnect', (peerInfo) => {
      const peerId = peerInfo.id.toB58String()
      removeFromArray(peerInfo, peers)
      disconnectKitsunetPeer(peerId)
      // remove stats associated with peer
      updateClientStateForLibp2pPeerDisconnect(peerId)
    })

    node.handle('/kitsunet/test/0.0.1', (protocol, conn) => {
      console.log('MetaMask Mesh Testing - incomming kitsunet connection')
      conn.getPeerInfo((err, peerInfo) => {
        if (err) return console.error(err)
        connectKitsunet(peerInfo, conn)
      })
    })

    node.handle('/kitsunet/test/ebt/0.0.1', (protocol, conn) => {
      console.log('MetaMask Mesh Testing - incomming kitsunet connection')
      conn.getPeerInfo((err, peerInfo) => {
        if (err) {
          console.error(err)
          return
        }
        global.ebt.request(peerInfo.id.toB58String(), true)
        const stream = toPull(global.ebt.createStream(peerInfo.id.toB58String()))
        pull(
          stream,
          pull.map(m => {
            console.dir(m)
            return Buffer.from(JSON.stringify(m))
          }),
          conn,
          pull.map(m => {
            return JSON.parse(m.toString())
          }),
          stream
        )
      })
    })

    // setup pubsub
    node.pubsub.subscribe('kitsunet-test1', (message) => {
      const { from, data, seqno, topicIDs } = message
      console.log(`pubsub message on "kitsunet-test1" from ${from}: ${data.toString()}`)
      // record message in client state
      clientState.pubsub.push({
        from,
        data: data.toString(),
        seqno: seqno.toString(),
        topicIDs
      })
      // publish new data to server
      if (serverAsync) submitNetworkState({ node, serverAsync })
    }, (err) => {
      console.log('subscribed to "kitsunet-test1"', err)
    })

    const multicast = createMulticast(node)
    node.multicast = multicast
    global.multicast = multicast
    node._multicast.start(() => {
      multicast.subscribe('kitsunet-test2', (message) => {
        const { from, data, seqno, hops, topicIDs } = message
        console.log(`multicast message on "kitsunet-test2" from ${from}: ${data.toString()}`)
        // record message in client state
        clientState.multicast.push({
          from,
          data: data.toString(),
          seqno: seqno.toString(),
          hops,
          topicIDs
        })
        // publish new data to server
        if (serverAsync) submitNetworkState({ node, serverAsync })
      }, (err) => {
        console.log('subscribed to "kitsunet-test1"', err)
      })

      multicast.subscribe('block-header', (message) => {
        const { from, data } = message

        let blockHeader = null
        try {
          blockHeader = JSON.parse(data.toString())
        } catch (err) {
          console.error(err)
          return
        }

        blockHeader = blockHeader || {}
        if (blockHeader.number && Number(blockHeader.number) <= Number(clientState.block.number)) return
        clientState.block = blockHeader

        console.log(`got new block header from ${from}`)
        // publish new data to server
        if (serverAsync) submitNetworkState({ node, serverAsync })
      }, (err) => {
        console.log('subscribed to "kitsunet-test1"', err)
      })
    })

    autoConnectWhenLonely(node, { minPeers: 4 })
    cb()
  })
}

function updateClientStateForLibp2pPeerConnect (peerId) {
  libp2pPeerStats[peerId] = { transports: {}, protocols: {}, mystery: createStat() }
}

function updateClientStateForLibp2pPeerDisconnect (peerId) {
  delete libp2pPeerStats[peerId]
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
    ping: async () => 'pong'
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
  while (clientState.peers[peer.id]) {
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
  // allow "skipDial" option from url (for debugging)
  if (location.search.includes('skipDial')) return
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

async function attemptDialEbt (peerInfo) {
  const peerId = peerInfo.id.toB58String()
  // attempt connection
  try {
    // console.log('MetaMask Mesh Testing - kitsunet dial', peerId)
    const conn = await pify(global.node.dialProtocol).call(global.node, peerInfo, '/kitsunet/test/ebt/0.0.1')
    console.log('MetaMask Mesh Testing - kitsunet-ebt dial success', peerId)
    global.ebt.request(peerId, true)
    const stream = toPull(global.ebt.createStream(peerId))
    pull(
      stream,
      pull.map(m => {
        return Buffer.from(JSON.stringify(m))
      }),
      conn,
      pull.map(m => {
        return JSON.parse(m.toString())
      }),
      stream
    )
  } catch (err) {
    console.log('MetaMask Mesh Testing - kitsunet-ebt dial failed:', peerId, err.message)
    // hangupPeer(peerInfo)
  }
}

function hangupPeer (peerInfo) {
  // const peerId = peerInfo.id.toB58String()
  global.node.hangUp(peerInfo, () => {
    // console.log('MetaMask Mesh Testing - did hangup', peerId)
  })
}

function updateClientStateWithLibp2pStats (node) {
  clientState.stats = libp2pStatsToJson()
}

function recordLibp2pStatsMessage (peerId, transport, protocol, direction, bufferLength) {
  // sanity check
  if (!peerId) return console.log('libp2pPeerStats message without peerId', peerId, transport, protocol, direction, bufferLength)
  // setup peer stats
  let peerStats = libp2pPeerStats[peerId]
  if (!peerStats) return
  // update timestamp
  peerStats.timestamp = Date.now()
  // record transport + protocol data (they come in seperately)
  if (transport) {
    const transportStats = peerStats.transports[transport] || (peerStats.transports[transport] = createStat())
    transportStats.push(statDirectionToEvent[direction], bufferLength)
  }
  if (protocol) {
    const protocolStats = peerStats.protocols[protocol] || (peerStats.protocols[protocol] = createStat())
    protocolStats.push(statDirectionToEvent[direction], bufferLength)
  }
  // record mysterious messages that dont have a transport or protocol
  if (!protocol && !transport) {
    peerStats.mystery.push(statDirectionToEvent[direction], bufferLength)
  }
}

function libp2pStatsToJson () {
  const allStats = { global: { transports: {}, protocols: {}, mystery: null }, peers: {} }
  // each peer
  Object.entries(libp2pPeerStats).forEach(([peerId, peerStatsContainer]) => {
    const peerStats = allStats.peers[peerId] = { transports: {}, protocols: {}, mystery: null }
    // mystery
    const mysteryStats = statObjToJson(peerStatsContainer.mystery)
    addStatsToGlobal(allStats.global, 'mystery', mysteryStats)
    peerStats.mystery = mysteryStats
    // each transport
    Object.keys(peerStatsContainer.transports).forEach((transportName) => {
      const transportStats = statObjToJson(peerStatsContainer.transports[transportName])
      addStatsToGlobal(allStats.global.transports, transportName, transportStats)
      peerStats.transports[transportName] = transportStats
    })
    // each protocol
    Object.keys(peerStatsContainer.protocols).forEach((protocolName) => {
      const protocolStats = statObjToJson(peerStatsContainer.protocols[protocolName])
      addStatsToGlobal(allStats.global.protocols, protocolName, protocolStats)
      peerStats.protocols[protocolName] = protocolStats
    })
  })
  return allStats

  function addStatsToGlobal (accumulator, name, newStats) {
    const container = accumulator[name] = accumulator[name] || createEmptyStatsJson()
    container.snapshot.dataReceived += newStats.snapshot.dataReceived
    container.snapshot.dataSent += newStats.snapshot.dataSent
    container.movingAverages.dataReceived['60000'] += newStats.movingAverages.dataReceived['60000']
    container.movingAverages.dataReceived['300000'] += newStats.movingAverages.dataReceived['300000']
    container.movingAverages.dataReceived['900000'] += newStats.movingAverages.dataReceived['900000']
    container.movingAverages.dataSent['60000'] += newStats.movingAverages.dataSent['60000']
    container.movingAverages.dataSent['300000'] += newStats.movingAverages.dataSent['300000']
    container.movingAverages.dataSent['900000'] += newStats.movingAverages.dataSent['900000']
  }
}

function createEmptyStatsJson () {
  return {
    snapshot: {
      dataReceived: 0,
      dataSent: 0
    },
    movingAverages: {
      dataReceived: {
        '60000': 0,
        '300000': 0,
        '900000': 0
      },
      dataSent: {
        '60000': 0,
        '300000': 0,
        '900000': 0
      }
    }
  }
}

function statObjToJson (statsObj) {
  return {
    snapshot: {
      dataReceived: Number.parseInt(statsObj.snapshot.dataReceived.toString()),
      dataSent: Number.parseInt(statsObj.snapshot.dataSent.toString())
    },
    movingAverages: {
      dataReceived: {
        '60000': statsObj.movingAverages.dataReceived['60000'].movingAverage(),
        '300000': statsObj.movingAverages.dataReceived['300000'].movingAverage(),
        '900000': statsObj.movingAverages.dataReceived['900000'].movingAverage()
      },
      dataSent: {
        '60000': statsObj.movingAverages.dataSent['60000'].movingAverage(),
        '300000': statsObj.movingAverages.dataSent['300000'].movingAverage(),
        '900000': statsObj.movingAverages.dataSent['900000'].movingAverage()
      }
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
    ]
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
