'use strict'

const reborn = require('rebirth')
const isNode = require('detect-node')
const { sec } = require('../util/time')
const timeout = require('../util/timeout')

const clientStateSubmitInterval = 15 * sec
const noop = () => {}
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
    stopLibp2pNode((err) => {
      if (err) console.log('Error stopping libp2p', err)
      telemetryRpc.disconnect()
      if (isNode) {
        return setTimeout(() => reborn(), 3 * sec)
      }
      // leave 3 sec for network activity
      setTimeout(() => self.location.reload(), 3 * sec)
    })
  }

  let rndvzLoop
  function startLibp2pNode (cb) {
    node.start(() => {
      node.on('peer:connect', (peerInfo) => {
        const peerId = peerInfo.id.toB58String()
        stats.updateOnConnect(peerId)
      })

      node.on('peer:disconnect', (peerInfo) => {
        const peerId = peerInfo.id.toB58String()
        // remove stats associated with peer
        stats.updateOnDisconnect(peerId)
      })

      const doRndvz = () => {
        node.rndvzDiscovery.unregister('/kitsunet/rndvz/1.0.0')
        node.rndvzDiscovery.register('/kitsunet/rndvz/1.0.0', 9)
      }

      doRndvz()
      setInterval(doRndvz, 10 * 1000)

      cb()
    })
  }

  function stopLibp2pNode (callback) {
    clearInterval(rndvzLoop)
    node.rndvzDiscovery.unregister('/kitsunet/rndvz/1.0.0')
    node.stop(callback)
    callback()
  }

  function hangupPeer (peerInfo) {
    // const peerId = peerInfo.id.toB58String()
    node.hangUp(peerInfo, () => {
      // console.log('MetaMask Mesh Testing - did hangup', peerId)
    })
  }

  return {
    startLibp2pNode,
    stopLibp2pNode,
    submitClientStateOnInterval,
    submitNetworkState,
    restart,
    restartWithDelay,
    hangupPeer,
    setTelemetryRpc: (telemetry) => { telemetryRpc = telemetry }
  }
}
