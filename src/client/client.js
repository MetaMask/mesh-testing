'use strict'

const { sec, min, hour } = require('../util/time')

const discoveredPeers = []
global.discoveredPeers = discoveredPeers
const maxDiscovered = 25

const clientStateSubmitInterval = 15 * sec
const peerPingInterval = 1 * min
const peerPingTimeout = 20 * sec
const autoConnectAttemptInterval = 10 * sec

const libp2pPeerStats = {}

module.exports = function (serverRpc, clientState, node) {
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

  function updateClientStateForLibp2pPeerConnect (peerId) {
    libp2pPeerStats[peerId] = { transports: {}, protocols: {}, mystery: createStat() }
  }

  function updateClientStateForLibp2pPeerDisconnect (peerId) {
    delete libp2pPeerStats[peerId]
  }

  function autoConnectWhenLonely (node, { minPeers }) {
    setInterval(() => {
      if (peers.length >= minPeers) return
      const peerInfo = discoveredPeers.shift()
      if (!peerInfo) return
      const peerId = peerInfo.id.toB58String()
      console.log('MetaMask Mesh Testing - kitsunet random dial:', peerId)
    }, autoConnectAttemptInterval)
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
        peers.push(peerInfo)
      })

      node.on('peer:disconnect', (peerInfo) => {
        const peerId = peerInfo.id.toB58String()
        removeFromArray(peerInfo, peers)
        // remove stats associated with peer
        updateClientStateForLibp2pPeerDisconnect(peerId)
      })

      autoConnectWhenLonely(node, { minPeers: 4 })
      cb()
    })
  }

  return {
    startLibp2pNode
  }
}
