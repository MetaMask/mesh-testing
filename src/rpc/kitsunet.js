'use strict'

const Base = require('./base')

const { sec, min } = require('../util/time')

function randomFromRange (min, max) {
  return min + Math.random() * (max - min)
}

class KitsunetRPC extends Base {
  constructor (kitsunet) {
    super()
    this.kitsunet = kitsunet
  }

  async refresh () {
    return this.kitsunet.restart()
  }

  async refreshShortDelay () {
    return this.kitsunet.restartWithDelay(randomFromRange(5 * sec, 10 * sec))
  }

  async refreshLongDelay () {
    return this.kitsunet.restartWithDelay(randomFromRange(2 * min, 10 * min))
  }

  async pubsubPublish (message) {
    return this.kitsunet.publish(message)
  }

  async multicastPublish (message, hops) {
    return this.kitsunet.multicastPublish(message, hops)
  }

  async ebtAppend (message) {
    return this.kitsunet.ebtAppend(message)
  }

  async enableBlockTracker (enabled) {
    return this.kitsunet.enableBlockTracker(enabled)
  }
}

module.exports = KitsunetRPC
