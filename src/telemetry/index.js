'use strict'

const { createRpc } = require('./rpc')
const createClientInterface = require('./interfaces/client')
const createServerInterface = require('./interfaces/server')
const { connectViaPost } = require('./network/telemetry')
const timeout = require('../util/timeout')
const { sec } = require('../util/time')

const DEFAULT_SUBMIT_INTERVAL = 15 * sec

class TelemetryClient {

  constructor ({ devMode, getState, clientId, submitInterval }) {
    this.getState = getState
    this.clientId = clientId
    this.submitInterval = submitInterval || DEFAULT_SUBMIT_INTERVAL

    const connection = connectViaPost({ devMode })
    this.telemetryRpc = createRpc({
      clientInterface: createClientInterface(),
      serverInterface: createServerInterface(),
      connection,
    })
  }

  start () {
    this.running = true
    this.telemetryRpc.setPeerId(this.clientId)
    this.submitStateOnInterval()
  }

  stop () {
    this.running = false
    this.telemetryRpc.disconnect()
  }

  async submitStateOnInterval () {
    try {
      while (this.running) {
        await this.submitState()
        await timeout(this.submitInterval)
      }
    } catch (err) {
      console.error(err)
    }
  }

  async submitState () {
    const state = this.getState()
    this.telemetryRpc.submitNetworkState(state)
  }

}

module.exports = TelemetryClient
