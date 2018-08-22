'use strict'

const Base = require('./base')

class ServerKitsunetRPC extends Base {
  constructor (server, client) {
    super()
    this.server = server
    this.client = client
  }

  async setPeerId (peerId) {
    this.client.peerId = peerId
    // update network state
    const networkState = this.server.networkStore.getState()
    networkState.clients[peerId] = {}
    this.server.networkStore.putState(networkState)
  }

  async submitNetworkState (clientState) {
    const peerId = this.client.peerId
    if (!peerId) return
    if (!this.server.clients.includes(this.client)) return
    // update network state
    const networkState = this.server.networkStore.getState()
    networkState.clients[peerId] = clientState
    this.server.networkStore.putState(networkState)
  }

  async disconnect () {
    console.log(`client "${this.peerId}" sent disconnect request`)
    this.server.disconnectClient(this.client)
  }
}

module.exports = ServerKitsunetRPC
