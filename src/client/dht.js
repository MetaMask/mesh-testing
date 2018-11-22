'use strict'

module.exports = createDht


function createDht (client, node, clientState) {

  setInterval(() => {
    if (!node._dht) return console.log('aborting dht state update')

    clientState.dht = {
      data: node._dht.datastore.data,
      routingTable: node._dht.routingTable.kb.toArray().map(contact => ({ id: contact.id })),
    }
  }, 1000)

  // high level api goes here
  return {}
}
