'use strict'

const pify = require('pify')
const pullStreamToStream = require('pull-stream-to-stream')

const endOfStream = require('end-of-stream')
const { sec, min } = require('../util/time')
const timeout = require('../util/timeout')

const { pingClientWithTimeout } = require('../network/clientTimeout')

const rpc = require('../rpc/rpc')
const baseRpc = require('../rpc/base')

const removeFromArray = require('../util/remoteFromArray')

const kitsunetPeers = []

const peers = []
const maxPeers = 500

const discoveredPeers = []
const maxDiscovered = 100

const peerPingInterval = 1 * min
const peerPingTimeout = 40 * sec

const autoConnectAttemptInterval = 10 * sec

module.exports = function (client, node, clientState, options) {
  options = options || { skipDial: false }
  async function attemptDial (peerInfo) {
    // allow "skipDial" option from url (for debugging)
    if (options['skipDial']) return
    const peerId = peerInfo.id.toB58String()
    checkAndHandgup(peerInfo)
    // check if already connected
    const alreadyConnected = !!clientState.peers[peerId]
    if (alreadyConnected) {
      console.log('MetaMask Mesh Testing - kitsunet already connected', peerId)
      return
    }
    // attempt connection
    try {
      console.log('MetaMask Mesh Testing - kitsunet dial', peerId)
      const conn = await pify(node.dialProtocol).call(node, peerInfo, '/kitsunet/test/0.0.1')
      console.log('MetaMask Mesh Testing - kitsunet dial success', peerId)
      await connectKitsunet(peerInfo, conn)
    } catch (err) {
      console.log('MetaMask Mesh Testing - kitsunet dial failed:', peerId, err.message)
      // hangupPeer(peerInfo)
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
    client.hangupPeer(kitsunetPeer.peerInfo)
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

    const kitsunetNodeRpc = rpc.createRpcServer(baseRpc(), stream)
    endOfStream(stream, (err) => {
      console.log(`peer rpcConnection disconnect ${peerId}`, err.message)
      disconnectKitsunetPeer(peer.id, err)
    })

    peer.rpcAsync = rpc.createRpcClient(baseRpc(), kitsunetNodeRpc)

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

  node.handle('/kitsunet/test/0.0.1', (_, conn) => {
    console.log('MetaMask Mesh Testing - incomming kitsunet connection')
    conn.getPeerInfo((err, peerInfo) => {
      if (err) return console.error(err)
      connectKitsunet(peerInfo, conn)
    })
  })

  node.on('peer:connect', (peerInfo) => {
    attemptDial(peerInfo)
    peers.push(peerInfo)
    // attempt to upgrage to kitsunet connection
    // attemptDial(peerInfo)
  })

  node.on('peer:disconnect', (peerInfo) => {
    const peerId = peerInfo.id.toB58String()
    removeFromArray(peerInfo, peers)
    disconnectKitsunetPeer(peerId)
  })

  node.on('peer:discovery', (peerInfo) => {
    const peerId = peerInfo.id.toB58String()
    console.log('MetaMask Mesh - node/peer:discovery', peerInfo.id.toB58String())
    // add to discovered peers list
    if (discoveredPeers.length >= maxDiscovered) return
    const alreadyExists = discoveredPeers.find(peerInfo => peerInfo.id.toB58String() === peerId)
    if (alreadyExists) return
    discoveredPeers.push(peerInfo)
    // attemptDial(peerInfo)
    // connectIfLonely({ minPeers })
  })

  function connectIfLonely ({ minPeers }) {
    // if (peers.length >= minPeers) return
    const peerInfo = discoveredPeers.shift()
    if (!peerInfo) return
    const peerId = peerInfo.id.toB58String()
    console.log('MetaMask Mesh Testing - kitsunet random dial:', peerId)
    attemptDial(peerInfo)
  }

  function autoConnectWhenLonely () {
    setInterval(() => {
      connectIfLonely({ minPeers: 20 })
    }, autoConnectAttemptInterval)
  }

  function checkAndHandgup (peerInfo) {
    // too many peers
    if (peers.length > maxPeers) {
      client.hangupPeer(peerInfo)
    }
  }

  return {
    attemptDial,
    disconnectKitsunetPeer,
    connectKitsunet,
    autoConnectWhenLonely,
    checkAndHandgup
  }
}
