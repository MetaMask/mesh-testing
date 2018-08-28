'use strict'

const WS = require('libp2p-websockets')
const Multiplex = require('libp2p-mplex')
const SECIO = require('libp2p-secio')
const Bootstrap = require('libp2p-bootstrap')
const Libp2p = require('libp2p')
const defaultsDeep = require('@nodeutils/defaults-deep')
const WStar = require('libp2p-webrtc-star')

const bootstrapers = [
  // '/dns4/tigress.kitsunet.metamask.io/tcp/443/wss/ipfs/QmZMmjMMP9VUyBkA6zFdEGmuFRdwjsiHZ3KtxMp89i7Xwv',
  // '/dns4/viper.kitsunet.metamask.io/tcp/443/wss/ipfs/QmR6X4y3N4pHMXCPf4NaN91sk9Gwz8TvRkMebK5Fjtwgoy',
  // '/dns4/crane.kitsunet.metamask.io/tcp/443/wss/ipfs/QmSJY8gjJYArR4u3rTjANWkSLwr75dVTjnknvdfbe7uiCi',
  // '/dns4/monkey.kitsunet.metamask.io/tcp/443/wss/ipfs/QmUA1Ghihi5u3gDwEDxhbu49jU42QPbvHttZFwB6b4K5oC',
  // '/dns4/starfish.lab.metamask.io/tcp/443/wss/ipfs/QmUA1Ghihi5u3gDwEDxhbu49jU42QPbvHttZFwB6b4K5oC'
  // '/dns4/bootstrap1.lab.metamask.io/tcp/443/wss/ipfs/QmUA1Ghihi5u3gDwEDxhbu49jU42QPbvHttZFwB6b4K5oC'
  '/ip4/127.0.0.1/tcp/30334/ws/ipfs/QmUA1Ghihi5u3gDwEDxhbu49jU42QPbvHttZFwB6b4K5oC'
]

class Node extends Libp2p {
  constructor (peerInfo, _options) {
    const wstar = new WStar()
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
        ]
      },
      config: {
        peerDiscovery: {
          bootstrap: {
            interval: 10000,
            enabled: true,
            list: bootstrapers
          }
        },
        relay: {
          enabled: true,
          hop: {
            enabled: true,
            active: true
          }
        }
      }
    }

    super(defaultsDeep(_options, defaults))
  }

  start (callback) {
    super.start((err) => {
      if (err) {
        return callback(err)
      }

      this.on('peer:discovery', (peerInfo) => {
        this.peerBook.put(peerInfo)
        this.dial(peerInfo, () => { })
      })

      this.on('peer:connect', (peerInfo) => {
        this.peerBook.put(peerInfo)
      })

      this.peerInfo.multiaddrs.forEach((ma) => {
        console.log('Swarm listening on', ma.toString())
      })
      callback()
    })
  }
}

module.exports = Node
