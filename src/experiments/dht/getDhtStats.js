'use strict'

module.exports = getDhtStats


function getDhtStats ({ node }) {
  return {
    // data: node._dht.datastore.data,
    routingTable: node._dht.routingTable.kb.toArray().map(contact => {
      return { id: contact.peer.toB58String() }
    }),
  }
}