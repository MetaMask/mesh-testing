'use strict'

const Base = require('./base')
const { sec } = require('../util/time')

const pump = require('pump')
const asStream = require('obs-store/lib/asStream')
const throttleStream = require('throttle-obj-stream')

const { toDiffs } = require('../util/jsonPatchStream')
const { createJsonSerializeStream } = require('../util/jsonSerializeStream')

const remoteCallTimeout = 45 * sec

class ServerAdminRPC extends Base {
  constructor (server, conn) {
    super()
    this.server = server
    this._conn = conn
  }

  // server data
  async getPeerCount () {
    return global.clients.length
  }

  async getNetworkState () {
    return global.networkStore.getState()
  }

  // send to client
  async sendToClient (clientId, method, args) {
    console.log(`forwarding "${method}" with (${args}) to client ${clientId}`)
    const client = this.server.clients.find(c => c.peerId === clientId)
    if (!client) {
      console.log(`no client found ${clientId}`)
      return
    }
    return this.server.sendCallWithTimeout(client.rpcAsync, method, args, remoteCallTimeout)
  }

  // broadcast
  async send (method, args) {
    console.log(`broadcasting "${method}" with (${args}) to ${global.clients.length} client(s)`)
    return this.server.broadcastCall(method, args, remoteCallTimeout)
  }

  async refresh () {
    return this.server.broadcastCall('refresh', [], remoteCallTimeout)
  }

  async refreshShortDelay () {
    return this.server.broadcastCall('refreshShortDelay', [], remoteCallTimeout)
  }

  refreshLongDelay () {
    return this.server.broadcastCall('refreshLongDelay', [], remoteCallTimeout)
  }

  async createNetworkUpdateStream () {
    const serializeStream = createJsonSerializeStream()
    pump(
      asStream(this.server.networkStore),
      // dont emit new values more than 2/sec
      throttleStream(500),
      toDiffs(),
      serializeStream,
      this._conn,
      (err) => {
        if (err) console.log('admin diff stream broke', err)
      }
    )
  }
}

module.exports = ServerAdminRPC
