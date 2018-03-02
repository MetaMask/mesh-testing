'use strict'

const WS = require('libp2p-websockets')
const WebRTCStar = require('libp2p-webrtc-star')
const WebSocketStar = require('libp2p-websocket-star')
const Multiplex = require('libp2p-multiplex')
const SECIO = require('libp2p-secio')
const Railing = require('libp2p-railing')
const libp2p = require('libp2p')

class Node extends libp2p {
  constructor (peerInfo, peerBook, options) {
    options = options || {}
    const wrtcstar = new WebRTCStar({id: peerInfo.id})
    const wsstar = new WebSocketStar({id: peerInfo.id})

    const modules = {
      transport: [
        new WS(),
        wrtcstar,
        wsstar
      ],
      connection: {
        muxer: [Multiplex],
        crypto: [SECIO]
      },
      discovery: [
        wrtcstar.discovery,
        wsstar.discovery
      ]
    }

    if (options.bootstrap) {
      const r = new Railing(options.bootstrap)
      modules.discovery.push(r)
    }

    super(modules, peerInfo, peerBook, options)
  }
}

module.exports = Node
