const createNode = require('./createNode')
createNode((err, node) => {
  // node.on('peer:discovery', (peerInfo) => {
  //   // console.log('node/peer:discovery', peerInfo.id.toB58String())
  //   console.log('node/peer:discovery', peerInfo.multiaddrs.toArray().map(i => i.toString()))
  //   console.log('node/peer:discovery', peerInfo.protocols)
  // })
  node.on('peer:connect', (peerInfo) => console.log('node/peer:connect', peerInfo.id.toB58String()))
  node.on('peer:disconnect', (peerInfo) => console.log('node/peer:disconnect', peerInfo.id.toB58String()))

  node.handle('/kitsunet/test/0.0.0', (protocol, conn) => {
    console.log('kitsunet connection established')
    conn.getPeerInfo((err, peerInfo) => {
      if (err) console.error(err)
      console.log('kitsunet peer:', peerInfo.id.toB58String())
    })
  })

  limitPeers(node, { maxPeers: 8 })
  // autoConnectAll(node)

  node.start(() => {
    console.log('libp2p node started')
  })
})

function autoConnectAll(node) {
  node.on('peer:discovery', (peerInfo) => {
    node.dial(peerInfo, () => console.log('did dial', peerInfo.id.toB58String()))
  })
}

function limitPeers(node, { maxPeers }) {
  const peers = []
  global.peers = peers

  node.on('peer:connect', (peerInfo) => {
    peers.push(peerInfo)
    // console.log('peers:', peers.map(peerInfo => peerInfo.id.toB58String()))
    checkLimit()
  })

  node.on('peer:disconnect', (peerInfo) => {
    removePeerFromList(peerInfo)
    // console.log('peers:', peers.map(peerInfo => peerInfo.id.toB58String()))
  })

  function checkLimit() {
    while (peers.length > maxPeers) {
      const doomedPeerInfo = selectPeerForDisconnect()
      node.hangUp(doomedPeerInfo, () => console.log('did hangup', doomedPeerInfo.id.toB58String()))
      removePeerFromList(doomedPeerInfo)
    }
  }

  function selectPeerForDisconnect() {
    return peers[0]
  }

  function removePeerFromList(peerInfo) {
    const index = peers.indexOf(peerInfo)
    if (index === -1) return
    peers.splice(index, 1)
  }
}
