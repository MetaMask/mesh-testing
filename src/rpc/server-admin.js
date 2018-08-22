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
  constructor (conn, initiator, server) {
    super(conn, initiator)
    this.server = server
  }

  // server data
  async getPeerCount () {
    return this._execRpc('getPeerCount', async () => {
      return global.clients.length
    })
  }

  async getNetworkState () {
    return this._execRpc('getNetworkState', async () => {
      return global.networkStore.getState()
    })
  }

  // send to client
  async sendToClient (clientId, method, args) {
    return this._execRpc('sendToClient', async () => {
      console.log(`forwarding "${method}" with (${args}) to client ${clientId}`)
      const client = this.server.clients.find(c => c.peerId === clientId)
      if (!client) {
        console.log(`no client found ${clientId}`)
        return
      }
      return this.server.sendCallWithTimeout(client.rpcAsync, method, args, remoteCallTimeout)
    })
  }
  // broadcast
  async send (method, args) {
    return this._execRpc('send', async () => {
      console.log(`broadcasting "${method}" with (${args}) to ${global.clients.length} client(s)`)
      return this.server.broadcastCall(method, args, remoteCallTimeout)
    })
  }

  async refresh () {
    return this._execRpc('refresh', async () => {
      return this.server.broadcastCall('refresh', [], remoteCallTimeout)
    })
  }

  async refreshShortDelay () {
    return this._execRpc('refreshShortDelay', async () => {
      return this.server.broadcastCall('refreshShortDelay', [], remoteCallTimeout)
    })
  }

  refreshLongDelay () {
    return this._execRpc('refreshLongDelay', async () => {
      return this.server.broadcastCall('refreshLongDelay', [], remoteCallTimeout)
    })
  }

  async createNetworkUpdateStream () {
    return this._execRpc('createNetworkUpdateStream', async () => {
      const serializeStream = createJsonSerializeStream()
      pump(
        asStream(global.networkStore),
        // dont emit new values more than 2/sec
        throttleStream(500),
        toDiffs(),
        serializeStream,
        this._conn,
        (err) => {
          if (err) console.log('admin diff stream broke', err)
        }
      )
    })
  }
}

module.exports = ServerAdminRPC
