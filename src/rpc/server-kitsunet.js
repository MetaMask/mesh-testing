'use strict'

const Base = require('./base')

class ServerKitsunetRPC extends Base {
  constructor (conn, initiator, server, client) {
    super(conn, initiator)
    this.server = server
    this.client = client
  }

  async setPeerId (peerId) {
    return this._execRpc('setPeerId', async () => {
      this.client.peerId = peerId
      // update network state
      const networkState = this.server.networkStore.getState()
      networkState.clients[peerId] = {}
      this.server.networkStore.putState(networkState)
    }, peerId)
  }

  async submitNetworkState (clientState) {
    return this._execRpc('submitNetworkState', async () => {
      const peerId = this.client.peerId
      if (!peerId) return
      if (!this.server.clients.includes(this.client)) return
      // update network state
      const networkState = this.server.networkStore.getState()
      networkState.clients[peerId] = clientState
      this.server.networkStore.putState(networkState)
    }, clientState)
  }

  async disconnect () {
    return this._execRpc('disconnect', async () => {
      console.log(`client "${this.peerId}" sent disconnect request`)
      this.server.disconnectClient(this.client)
    })
  }
}

module.exports = ServerKitsunetRPC
