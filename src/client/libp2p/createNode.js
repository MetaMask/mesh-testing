'use strict'
const { KitsunetFactory } = require('kitsunet')
const pify = require('pify')
const PeerInfo = pify(require('peer-info'))
const PeerId = pify(require('peer-id'))

async function createNode({identity, addrs, persistenceMode, devMode }) {
  addrs = addrs || []
  const kitsunet = await KitsunetFactory.createKitsunet({
      identity,
      libp2pAddrs: addrs,
      ethNetwork: 'mainnet',
      ethChainDb: 'kitsunet',
      NODE_ENV: devMode ? 'dev' : 'prod',
      sliceDepth: 10,
      rpcUrl: 'http://localhost:8546',
      ethAddrs: [
        '0x52bc44d5378309ee2abf1539bf71de1b7d7be3b5',
        '0x6810e776880c02933d47db1b9fc05908e5386b96',
        '0x1d805bc00b8fa3c96ae6c8fa97b2fd24b19a9801'
      ],
      slicePath: [
        '8e99',
        '1372'
      ],
      dialInterval: 10000
  })

  const node = kitsunet.networkNodes.find(n => n.type === 0)
  if (!node) throw new Error('no libp2p node found!')
  node.peerId = identity.id

  return { node: node.node, kitsunet }
}

module.exports = createNode
