'use strict'

const WS = require('libp2p-websockets')
const TCP = require('libp2p-tcp')
const Multiplex = require('libp2p-mplex')
const SECIO = require('libp2p-secio')
const Bootstrap = require('libp2p-bootstrap')
const Libp2p = require('libp2p')
const defaultsDeep = require('@nodeutils/defaults-deep')
const WStar = require('libp2p-webrtc-star')
// const MDNS = require('libp2p-mdns')

const isNode = require('detect-node')

const { Discovery } = require('libp2p-rendezvous')

const bootstrapers = [
  '/dns4/bootstrap1.lab.metamask.io/tcp/443/wss/ipfs/QmUA1Ghihi5u3gDwEDxhbu49jU42QPbvHttZFwB6b4K5oC'
  // '/ip4/127.0.0.1/tcp/30334/ws/ipfs/QmUA1Ghihi5u3gDwEDxhbu49jU42QPbvHttZFwB6b4K5oC',
  // '/ip4/127.0.0.1/tcp/30333/ipfs/QmUA1Ghihi5u3gDwEDxhbu49jU42QPbvHttZFwB6b4K5oC',
  // '/ip4/127.0.0.1/tcp/30336/ws/ipfs/QmZMmjMMP9VUyBkA6zFdEGmuFRdwjsiHZ3KtxMp89i7Xwv'
  // '/ip4/127.0.0.1/tcp/30337/ipfs/QmZMmjMMP9VUyBkA6zFdEGmuFRdwjsiHZ3KtxMp89i7Xwv',
  // '/ip4/127.0.0.1/tcp/9001/ws/ipfs/QmSZiZG1c1vk7M3jcQpE3rw7Cughi6HQ1X18fVt1k9Hy2m'
]

class Node extends Libp2p {
  constructor (peerInfo, _options) {
    const wstar = new WStar()
    const rndvzDiscovery = new Discovery({ interval: 60 * 1000 })
    const defaults = {
      peerInfo,
      modules: {
        transport: [
          wstar,
          WS
        ],
        streamMuxer: [
          Multiplex
        ],
        connEncryption: [
          SECIO
        ],
        peerDiscovery: [
          Bootstrap,
          wstar.discovery
          // MDNS
        ]
      },
      config: {
        peerDiscovery: {
          bootstrap: {
            interval: 2 * 1000,
            enabled: true,
            list: bootstrapers
          },
          mdns: { // mdns options
            interval: 30 * 1000, // ms
            enabled: true
          }
        },
        relay: {
          enabled: true,
          hop: {
            enabled: false,
            active: false
          }
        }
      },
      connectionManager: {
        maxPeers: 20
      }
    }

    if (isNode) {
      defaults.modules.transport.push(TCP)
    }

    super(defaultsDeep(_options, defaults))
    rndvzDiscovery.init(this)
    this.rndvzDiscovery = rndvzDiscovery
    this.rndvzDiscovery.on('peer', (peerInfo) => this.emit('peer:discovery', peerInfo))
  }

  start (callback) {
    super.start((err) => {
      if (err) {
        return callback(err)
      }

      this.peerInfo.multiaddrs.forEach((ma) => {
        console.log('Swarm listening on', ma.toString())
      })

      const isBootstrapper = (peerInfo) => bootstrapers.find((addr) => {
        return peerInfo.multiaddrs.toArray().map(a => a.toString()).includes(addr)
      })

      this.on('peer:discovery', (peerInfo) => {
        const peer = this.peerBook.getAll()[peerInfo.id.toB58String()]
        if (peer && peer.isConnected()) return

        if (isBootstrapper(peerInfo)) {
          this.dial(peerInfo, () => {})
        }
      })

      this.rndvzDiscovery.start(callback)
    })
  }

  stop (callback) {
    super.stop((err) => {
      if (err) {
        return callback(err)
      }

      this.rndvzDiscovery.stop(callback)
    })
  }
}

module.exports = Node
