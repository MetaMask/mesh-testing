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

    if (options.bootstrap) {
      const r = new Railing(options.bootstrap)
      modules.discovery.push(r)
    }

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

  stop(callback) {
    series([
      (cb) => this._rndvzDiscovery.stop(cb),
      (cb) => super.stop(cb)
    ], callback)
  }

  register (ns, ttl, callback) {
    if (typeof ttl === 'function') { 
      callback = ttl
      ttl = 10 * 60 // 10 mins in seconds
    }

    this._rndvzDiscovery.register(ns, ttl, callback)
  }

  unregister (ns, callback) {
    this._rndvzDiscovery.unregister(ns, callback)
  }
}

module.exports = Node
