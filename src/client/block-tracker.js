'use strict'

const createEthProvider = require('../eth-provider')
const hexUtils = require('../eth-provider/hex-utils')

module.exports = function (node, clientState, trackerRpcUrl) {
  const blocks = new Map()
  const ethProvider = createEthProvider({ rpcUrl: trackerRpcUrl || 'https://mainnet.infura.io/' })

  const trackerCb = (blockNumber) => {
    console.log(`latest block is: ${Number(blockNumber)}`)
    const cleanHex = hexUtils.formatHex(blockNumber)
    ethProvider.ethQuery.getBlockByNumber(cleanHex, false, (err, block) => {
      if (err) {
        console.error(err)
        return
      }
      publish(Buffer.from(JSON.stringify(block)))
    })
  }

  function enable (enabled) {
    clientState.blockTrackerEnabled = enabled
    if (clientState.blockTrackerEnabled) {
      // setup block storage
      ethProvider.blockTracker.on('latest', trackerCb)
    } else {
      ethProvider.blockTracker.removeListener('latest', trackerCb)
    }
  }

  function publish (blockHeader) {
    node.multicast.publish('block-header', blockHeader, -1, (err) => {
      if (err) {
        console.error(err)
      }
    })
  }

  node.multicast.addFrwdHooks('block-header', [(peer, msg) => {
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

  return {
    enable,
    publish
  }
}
