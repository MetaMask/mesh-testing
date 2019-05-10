const pify = require('pify')

class PeersExperiment {
  constructor ({ node, peerConnectionTracker, rpcInterface }) {
    this._peerConnectionTracker = peerConnectionTracker

    rpcInterface.peers = {
      disconnectAllPeers: async () => {
        const peers = Array.from(this._peerConnectionTracker)
        await Promise.all(
          peers.map(async (peerIdB58Str) => {
            const peerInfo = node.peerBook.get(peerIdB58Str)
            await pify(cb => node.hangUp(peerInfo, cb))()
            peerConnectionTracker.has(peerIdB58Str)
          })
        )
      },
    }
  }

  getState() {
    return {
      peers: Array.from(this._peerConnectionTracker)
    }
  }
}

module.exports = PeersExperiment