const Libp2pTrafficStats = require('./traffic')

class Libp2pStats {
  constructor ({ node }) {
    this.traffic = new Libp2pTrafficStats({ node })
  }

  start () {
    this.traffic.start()
  }

  stop () {
    this.traffic.stop()
  }

  getState () {
    return {
      traffic: this.traffic.getState(),
    }
  }
}

module.exports = Libp2pStats
