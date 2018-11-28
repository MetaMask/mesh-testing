class Libp2pDhtStats {

  constructor ({ node }) {
    this._node = node
  }

  start () {}

  stop () {}

  getState () {
    const node = this._node
    const dht = node._dht
    if (!dht) return
    const kBucket = dht.routingTable.kb
    if (!kBucket) return
    return {
      data: dht.datastore.data,
      routingTable: kBucket.toArray().map(contact => {
        return { id: contact.peer.toB58String() }
      }),
    }
  }
}

module.exports = Libp2pDhtStats
