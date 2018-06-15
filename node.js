'use strict'

const WS = require('libp2p-websockets')
const WebRTCStar = require('libp2p-webrtc-star')
const WebSocketStar = require('libp2p-websocket-star')
const Multiplex = require('libp2p-multiplex')
const SECIO = require('libp2p-secio')
const Railing = require('libp2p-railing')
const Libp2p = require('libp2p')
const {Discovery} = require('libp2p-rendezvous')
const series = require('async/series')

class Node extends Libp2p {
  constructor (peerInfo, peerBook, options) {
    options = options || {}
    // const wrtcstar = new WebRTCStar({id: peerInfo.id})
    // const wsstar = new WebSocketStar({id: peerInfo.id})

    const modules = {
      transport: [
        new WS(),
        // wrtcstar,
        // wsstar
      ],
      connection: {
        muxer: [Multiplex],
        crypto: [SECIO]
      },
      discovery: [
        // wrtcstar.discovery,
        // wsstar.discovery
      ]
    }

    if (options.bootstrap) {
      const r = new Railing(options.bootstrap)
      modules.discovery.push(r)
    }

    super(modules, peerInfo, peerBook, options)
    this._rndvzDiscovery = new Discovery(this)
    this._rndvzDiscovery.on('peer', (peerInfo) => this.emit('peer:discovery', peerInfo))
  }

  start(callback) {
    series([
      (cb) => super.start(cb),
      (cb) => this._rndvzDiscovery.start(cb)
    ], callback)
  }

  stop(callback) {
    series([
      (cb) => this._rndvzDiscovery.stop(cb),
      (cb) => super.stop(cb)
    ], callback)
  }

  register(ns, callback) {
    this._rndvzDiscovery.register(ns, callback)
  }

  unregister(ns, callback) {
    this._rndvzDiscovery.unregister(ns, callback)
  }
}

module.exports = Node
