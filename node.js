'use strict'

const WS = require('libp2p-websockets')
const WebRTCCircuit = require('libp2p-webrtc-circuit')
const Multiplex = require('libp2p-mplex')
const SECIO = require('libp2p-secio')
const Railing = require('libp2p-railing')
const Libp2p = require('libp2p')
const {Discovery} = require('libp2p-rendezvous')
const series = require('async/series')

class Node extends Libp2p {
  constructor (peerInfo, peerBook, options) {
    options = options || {}

    const modules = {
      transport: [
        new WS()
      ],
      connection: {
        muxer: [Multiplex],
        crypto: [SECIO]
      },
      discovery: []
    }

    const r = new Railing({
      list: [
      // '/dns4/tigress.kitsunet.metamask.io/tcp/443/wss/ipfs/QmZMmjMMP9VUyBkA6zFdEGmuFRdwjsiHZ3KtxMp89i7Xwv',
      // '/dns4/viper.kitsunet.metamask.io/tcp/443/wss/ipfs/QmR6X4y3N4pHMXCPf4NaN91sk9Gwz8TvRkMebK5Fjtwgoy',
      // '/dns4/crane.kitsunet.metamask.io/tcp/443/wss/ipfs/QmSJY8gjJYArR4u3rTjANWkSLwr75dVTjnknvdfbe7uiCi',
      // '/dns4/monkey.kitsunet.metamask.io/tcp/443/wss/ipfs/QmUA1Ghihi5u3gDwEDxhbu49jU42QPbvHttZFwB6b4K5oC',
      // '/dns4/starfish.lab.metamask.io/tcp/443/wss/ipfs/QmUA1Ghihi5u3gDwEDxhbu49jU42QPbvHttZFwB6b4K5oC',
        '/ip4/127.0.0.1/tcp/30334/ws/ipfs/QmUA1Ghihi5u3gDwEDxhbu49jU42QPbvHttZFwB6b4K5oC'
      ]
    })
    modules.discovery.push(r)

    super(modules, peerInfo, peerBook, options)
    this._rndvzDiscovery = new Discovery(this)
    this._rndvzDiscovery.on('peer', (peerInfo) => this.emit('peer:discovery', peerInfo))
    this.modules.discovery.push(this._rndvzDiscovery)
    this.modules.transport.push(new WebRTCCircuit(this))
  }

  start (callback) {
    series([
      (cb) => super.start(cb),
      (cb) => this._rndvzDiscovery.start(cb)
    ], callback)
  }

  stop (callback) {
    series([
      (cb) => this._rndvzDiscovery.stop(cb),
      (cb) => super.stop(cb)
    ], callback)
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
