'use strict'

const PeerInfo = require('peer-info')
const PeerId = require('peer-id')
const pify = require('pify')
const Node = require('./node')
const isNode = require('detect-node')

async function createNode ({ id, addrs, devMode }, callback) {
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
      if (devMode) {
        if (isNode) {
          peerInfo.multiaddrs.add(`/ip4/127.0.0.1/tcp/0/ws/ipfs/${peerIdStr}`)
          peerInfo.multiaddrs.add(`/ip4/127.0.0.1/tcp/0/ipfs/${peerIdStr}`)
        } else {
          peerInfo.multiaddrs.add(`/ip4/127.0.0.1/tcp/9090/ws/p2p-webrtc-star/ipfs/${peerIdStr}`)
        }
      } else {
        peerInfo.multiaddrs.add(`/dns4/signaller.lab.metamask.io/tcp/443/wss/p2p-webrtc-star/ipfs/${peerIdStr}`)
      }
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
