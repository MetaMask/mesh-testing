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
    // peerInfo.multiaddrs.add(`/dns4/ws-star.discovery.libp2p.io/tcp/443/wss/p2p-websocket-star/ipfs/${peerIdStr}`)
    // peerInfo.multiaddrs.add(`/ip4/127.0.0.1/tcp/9090/ws/p2p-websocket-star`)
    // peerInfo.multiaddrs.add(`/ip4/127.0.0.1/tcp/4003/ws/ipfs/${peerIdStr}`)
    // wrtc
    // peerInfo.multiaddrs.add(`/dns4/wrtc-star.discovery.libp2p.io/tcp/443/wss/p2p-webrtc-star/ipfs/${peerIdStr}`)

    // peerInfo.multiaddrs.add(`/ipfs/${peerIdStr}/p2p-webrtc-circuit`)
    // peerInfo.multiaddrs.add(`/dns4/monkey.kitsunet.metamask.io/tcp/443/wss/p2p-webrtc-star/ipfs/${peerIdStr}`)
    // peerInfo.multiaddrs.add(`/dns4/signaller.lab.metamask.io/tcp/443/wss/p2p-webrtc-star/ipfs/${peerIdStr}`)
    peerInfo.multiaddrs.add(`/ip4/127.0.0.1/tcp/9090/ws/p2p-webrtc-star/ipfs/${peerIdStr}`)
    const node = new Node(peerInfo, {
      config: {
        EXPERIMENTAL: {
          pubsub: true
        }
      }
    })
    node.idStr = peerIdStr

    callback(null, node)
  })
}

module.exports = createNode
