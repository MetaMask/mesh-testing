class Libp2pDhtStats {

  constructor ({ node }) {
    this._node = node
  }

  start () {}
  
  stop () {}

  getState () {
    const node = this._node
    if (!node._dht) return
    return {
      data: node._dht.datastore.data,
      routingTable: node._dht.routingTable.kb.toArray().map(contact => {
        return { id: contact.peer.toB58String() }
      }),
    }
  }
}

module.exports = Libp2pDhtStats
