'use strict'

const PeerInfo = require('peer-info')
const Node = require('./node')

function createNode (callback) {
  PeerInfo.create((err, peerInfo) => {
    if (err) {
      return callback(err)
    }

    const peerIdStr = peerInfo.id.toB58String()

    // ws
    peerInfo.multiaddrs.add(`/dns4/ws-star.discovery.libp2p.io/tcp/443/wss/p2p-websocket-star/ipfs/${peerIdStr}`)
    // wrtc
    // peerInfo.multiaddrs.add(`/dns4/wrtc-star.discovery.libp2p.io/tcp/443/wss/p2p-webrtc-star/ipfs/${peerIdStr}`)

    const node = new Node(peerInfo)
    node.idStr = peerIdStr

    callback(null, node)
  })
}

module.exports = createNode
