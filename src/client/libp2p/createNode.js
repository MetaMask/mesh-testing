'use strict'

const PeerInfo = require('peer-info')
const PeerId = require('peer-id')
const pify = require('pify')
const Node = require('./node')
const isNode = require('detect-node')

async function createNode (id, addrs, callback) {
  if (typeof id === 'function') {
    callback = id
    id = null
    addrs = null
  }

  if (typeof addrs === 'function') {
    callback = addrs
    addrs = null
  }

  if (!id.privKey) {
    id = await pify(PeerId.create)()
  } else {
    id = await pify(PeerId.createFromJSON)(id)
  }

  addrs = addrs || null

  PeerInfo.create(id, (err, peerInfo) => {
    if (err) {
      return callback(err)
    }

    const peerIdStr = peerInfo.id.toB58String()

    if (addrs) {
      addrs.forEach((a) => peerInfo.multiaddrs.add(a))
    } else {
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
      // peerInfo.multiaddrs.add(`/ip4/127.0.0.1/tcp/0/ipfs/${peerIdStr}`)
      // peerInfo.multiaddrs.add(`/ip4/127.0.0.1/tcp/0/ws/ipfs/${peerIdStr}`)
      // if (isNode) peerInfo.multiaddrs.add(`/ip4/127.0.0.1/tcp/0/ipfs/${peerIdStr}`)
      // peerInfo.multiaddrs.add(`/ip4/127.0.0.1/tcp/0/ws/p2p-webrtc-circuit/ipfs/${peerIdStr}`)
    }

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
