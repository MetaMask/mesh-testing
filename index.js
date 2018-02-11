// const IPFS = require('ipfs')
// const node = new IPFS()
//
//
// node.on('ready', () => console.log('ready - Node is ready to use when you first create it'))
// node.on('error', () => console.log('error - Node has hit some error while initing/starting'))
// node.on('init', () => console.log('init - Node has successfully finished initing the repo'))
// node.on('start', () => console.log('start - Node has started'))
// node.on('stop', () => console.log('stop - Node has stopped'))
//
//
// node.once('ready', () => {
//
//   // console.log('libp2p', node.libp2p)
//   // console.log('_libp2pNode', node._libp2pNode)
//
//   node._libp2pNode.on('peer:discovery', (peer) => console.log('peer:discovery', peer.id.toB58String()))
//   node._libp2pNode.on('peer:connect', (peer) => console.log('peer:connect', peer.id.toB58String()))
//   node._libp2pNode.on('peer:disconnect', (peer) => console.log('peer:disconnect', peer.id.toB58String()))
//
// })


// const Libp2pNode = require('./node')
const createNode = require('./createNode')
createNode((err, node) => {
  node.start(() => {
    node.on('peer:discovery', (peer) => console.log('peer:discovery', peer.id.toB58String()))
    node.on('peer:connect', (peer) => console.log('peer:connect', peer.id.toB58String()))
    node.on('peer:disconnect', (peer) => console.log('peer:disconnect', peer.id.toB58String()))
  })
})
