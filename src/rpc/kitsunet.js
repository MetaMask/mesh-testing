'use strict'

const Base = require('./base')

const { sec, min } = require('../util/time')

function randomFromRange (min, max) {
  return min + Math.random() * (max - min)
}

class KitsunetRPC extends Base {
  constructor (conn, initiator, kitsunet) {
    super(conn, initiator)
    this.kitsunet = kitsunet
  }

  async refresh () {
    return this._execRpc('refresh', async () => {
      return this.kitsunet.restart()
    })
  }

  async refreshShortDelay () {
    return this._execRpc('refreshShortDelay', async () => {
      return this.kitsunet.restartWithDelay(randomFromRange(5 * sec, 10 * sec))
    })
  }

  async refreshLongDelay () {
    return this._execRpc('refreshLongDelay', async () => {
      return this.kitsunet.restartWithDelay(randomFromRange(2 * min, 10 * min))
    })
  }

  async pubsubPublish (message) {
    return this._execRpc('pubsubPublish', async () => {
      return this.kitsunet.publish(message)
    }, message)
  }

  async multicastPublish (message, hops) {
    return this._execRpc('multicastPublish', async () => {
      return this.kitsunet.multicastPublish(message, hops)
    }, message, hops)
  }

  async ebtAppend (message) {
    return this._execRpc('ebtAppend', async () => {
      return this.kitsunet.ebtAppend(message)
    }, message)
  }

  async enableBlockTracker (enabled) {
    return this._execRpc('enableBlockTracker', async () => {
      return this.kitsunet.enableBlockTracker(enabled)
    }, enabled)
  }
}

module.exports = KitsunetRPC
