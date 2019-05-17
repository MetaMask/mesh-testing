'use strict'

const pify = require('pify')
const wrtc = require('wrtc')
const Libp2p = require('libp2p')
const WS = require('libp2p-websockets')
const WStar = require('libp2p-webrtc-star')
const Mplex = require('libp2p-mplex')
// const Bootstrap = require('libp2p-bootstrap')
const DHT = require('libp2p-kad-dht')
const PeerInfo = pify(require('peer-info'))
const PeerId = pify(require('peer-id'))

async function createNode ({ identity, addrs, datastore }) {
  let id = {}
  const privKey = identity && identity.privKey ? identity.privKey : null
  if (!privKey) {
    id = await PeerId.create()
  } else {
    id = await PeerId.createFromJSON(identity)
  }

  const peerInfo = await PeerInfo.create(id)
  const peerIdStr = peerInfo.id.toB58String()

  addrs = addrs || []
  addrs.forEach((a) => peerInfo.multiaddrs.add(a))

  const wstar = new WStar({ wrtc })
  const node = new Libp2p({
    datastore,
    peerInfo,
    modules: {
      transport: [
        WS,
        wstar
      ],
      streamMuxer: [
        Mplex
      ],
      peerDiscovery: [
        wstar.discovery,
        // Bootstrap
      ],
      dht: DHT,
    },
    connectionManager: {
      minPeers: 3,
      // this needs to be bigger than (kbucket/2)*(alpha=3) size
      maxPeers: 40,
    },
    config: {
      peerDiscovery: {
        // bootstrap: {
        //   list: bootstrap,
        //   interval: 1000
        // }
      },
      dht: {
        enabled: true,
        kBucketSize: 20,
        randomWalk: {
          enabled: false,
          // interval: 30000
          // queriesPerPeriod: 1
          // timeout: 10000
        }
      },
    }
  })
  node.peerId = peerIdStr

  return node
}

module.exports = createNode
