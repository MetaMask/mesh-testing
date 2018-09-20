'use strict'

const { sec } = require('../util/time')
const timeout = require('../util/timeout')

const removeFromArray = require('../util/remoteFromArray')

const peers = []

const discoveredPeers = []
const maxDiscovered = 25

const clientStateSubmitInterval = 15 * sec
const autoConnectAttemptInterval = 10 * sec

const maxPeers = 16

module.exports = function (clientState, node, stats) {
  let telemetryRpc = null

  async function submitClientStateOnInterval () {
    while (true) {
      try {
        await submitNetworkState()
      } catch (err) {
        console.log(err)
      }
      await timeout(clientStateSubmitInterval)
    }
  }

  async function submitNetworkState () {
    stats.updateStats()
    if (telemetryRpc) return telemetryRpc.submitNetworkState(clientState)
  }

  function restartWithDelay (timeoutDuration) {
    console.log(`MetaMask Mesh Testing - restarting in ${timeoutDuration / 1000} sec...`)
    setTimeout(restart, timeoutDuration)
  }

  function restart () {
    console.log('restarting...')
    telemetryRpc.disconnect()
    // leave 3 sec for network activity
    setTimeout(() => window.location.reload(), 3 * sec)
  }

  function autoConnectWhenLonely ({ minPeers }) {
    setInterval(() => {
      if (peers.length >= minPeers) return
      const peerInfo = discoveredPeers.shift()
      if (!peerInfo) return
      const peerId = peerInfo.id.toB58String()
      console.log('MetaMask Mesh Testing - kitsunet random dial:', peerId)
    }, autoConnectAttemptInterval)
  }

  function startLibp2pNode (cb) {
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
        stats.updateOnConnect(peerId)
        peers.push(peerInfo)
      })

      node.on('peer:disconnect', (peerInfo) => {
        const peerId = peerInfo.id.toB58String()
        removeFromArray(peerInfo, peers)
        // remove stats associated with peer
        stats.updateOnDisconnect(peerId)
      })

      autoConnectWhenLonely(node, { minPeers: 4 })
      cb()
    })
  }

  function hangupPeer (peerInfo) {
    // const peerId = peerInfo.id.toB58String()
    node.hangUp(peerInfo, () => {
      // console.log('MetaMask Mesh Testing - did hangup', peerId)
    })
  }

  function checkAndHandgup (peerInfo) {
    // too many peers
    if (peers.length > maxPeers) {
      hangupPeer(peerInfo)
    }
  }

  return {
    startLibp2pNode,
    submitClientStateOnInterval,
    submitNetworkState,
    autoConnectWhenLonely,
    autoConnectAttemptInterval,
    restart,
    restartWithDelay,
    hangupPeer,
    checkAndHandgup,
    setTelemetryRpc: (telemetry) => { telemetryRpc = telemetry }
  }
}
