'use strict'

const base = require('./base')

module.exports = function (server, client) {
  return Object.assign({}, {
    setPeerId: async (peerId) => {
      client.peerId = peerId
      // update network state
      const networkState = server.networkStore.getState()
      networkState.clients[peerId] = {}
      server.networkStore.putState(networkState)
    },
    submitNetworkState: async (clientState) => {
      const peerId = client.peerId
      if (!peerId) return
      if (!server.clients.includes(client)) return
      // update network state
      const networkState = server.networkStore.getState()
      networkState.clients[peerId] = clientState
      server.networkStore.putState(networkState)
    },
    disconnect: async (peerId) => {
      console.log(`client "${peerId}" sent disconnect request`)
      server.disconnectClient(client)
    }
  }, base())
}
