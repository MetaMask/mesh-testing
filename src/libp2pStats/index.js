const Libp2pTrafficStats = require('./traffic')
const Libp2pDhtStats = require('./dht')

class Libp2pStats {

  constructor ({ node }) {
    this.traffic = new Libp2pTrafficStats({ node })
    this.dht = new Libp2pDhtStats({ node })
  }

  start () {
    this.traffic.start()
    this.dht.start()
  }

  stop () {
    this.traffic.stop()
    this.dht.stop()
  }

  getState () {
    return {
      traffic: this.traffic.getState(),
      dht: this.dht.getState(),
    }
  }
  
}

module.exports = Libp2pStats
