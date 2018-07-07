'use strict'

const WS = require('libp2p-websockets')
const WebRTCCircuit = require('libp2p-webrtc-circuit')
const Multiplex = require('libp2p-mplex')
const SECIO = require('libp2p-secio')
const Bootstrap = require('libp2p-bootstrap')
const Libp2p = require('libp2p')
const {Discovery} = require('libp2p-rendezvous')
const defaultsDeep = require('@nodeutils/defaults-deep')

const bootstrapers = [
  // '/dns4/tigress.kitsunet.metamask.io/tcp/443/wss/ipfs/QmZMmjMMP9VUyBkA6zFdEGmuFRdwjsiHZ3KtxMp89i7Xwv',
  // '/dns4/viper.kitsunet.metamask.io/tcp/443/wss/ipfs/QmR6X4y3N4pHMXCPf4NaN91sk9Gwz8TvRkMebK5Fjtwgoy',
  // '/dns4/crane.kitsunet.metamask.io/tcp/443/wss/ipfs/QmSJY8gjJYArR4u3rTjANWkSLwr75dVTjnknvdfbe7uiCi',
  // '/dns4/monkey.kitsunet.metamask.io/tcp/443/wss/ipfs/QmUA1Ghihi5u3gDwEDxhbu49jU42QPbvHttZFwB6b4K5oC'
  // '/dns4/starfish.lab.metamask.io/tcp/443/wss/ipfs/QmUA1Ghihi5u3gDwEDxhbu49jU42QPbvHttZFwB6b4K5oC',
  '/ip4/127.0.0.1/tcp/30334/ws/ipfs/QmUA1Ghihi5u3gDwEDxhbu49jU42QPbvHttZFwB6b4K5oC'
]

class Node extends Libp2p {
  constructor (peerInfo, _options) {
    const webRTCCircuit = new WebRTCCircuit()
    const rndvzDiscovery = new Discovery()
    const defaults = {
      peerInfo,
      modules: {
        transport: [
          WS,
          webRTCCircuit
        ],
        streamMuxer: [
          Multiplex
        ],
        connEncryption: [
          SECIO
        ],
        peerDiscovery: [
          Bootstrap,
          rndvzDiscovery
        ]
      },
      config: {
        peerDiscovery: {
          bootstrap: {
            interval: 2000,
            enabled: true,
            list: bootstrapers
          }
        }
      }
    }

    super(defaultsDeep(_options, defaults))
    webRTCCircuit.setLibp2p(this)
    rndvzDiscovery.init(this)
    this._rndvzDiscovery = rndvzDiscovery
  }

  register (ns, ttl, callback) {
    if (typeof ttl === 'function') {
      callback = ttl
      ttl = null
    }

    if (!ttl) {
      ttl = 60 * 60 // 60 mins (in seconds)
    }

    this._rndvzDiscovery.register(ns, ttl, callback)
  }

  unregister (ns, callback) {
    this._rndvzDiscovery.unregister(ns, callback)
  }
}

module.exports = Node
