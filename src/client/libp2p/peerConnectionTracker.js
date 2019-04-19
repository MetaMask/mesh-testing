module.exports = createPeerConnectionTracker

function createPeerConnectionTracker ({ node }) {
  const connectedPeers = new Set()
  node.on('peer:connect', (peer) => connectedPeers.add(peer.id.toB58String()))
  node.on('peer:disconnect', (peer) => connectedPeers.delete(peer.id.toB58String()))
  return connectedPeers
}