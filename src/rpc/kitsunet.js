'use strict'

const Base = require('./base')

const { sec, min } = require('../util/time')

function randomFromRange (min, max) {
  return min + Math.random() * (max - min)
}

class KitsunetRPC extends Base {
  constructor (client, multicast, pubsub, ebt, blockTracker) {
    super()
    this.client = client
    this.multicast = multicast
    this.pubsub = pubsub
    this.ebt = ebt
    this.blockTracker = blockTracker
  }

  async refresh () {
    return this.client.restart()
  }

  async refreshShortDelay () {
    return this.client.restartWithDelay(randomFromRange(5 * sec, 10 * sec))
  }

  async refreshLongDelay () {
    return this.client.restartWithDelay(randomFromRange(2 * min, 10 * min))
  }

  async pubsubPublish (message) {
    return this.pubsub.publish(message)
  }

  async multicastPublish (message, hops) {
    return this.multicast.publish(message, hops)
  }

  async ebtAppend (message) {
    return this.ebt.append(message)
  }

  async enableBlockTracker (enabled) {
    return this.blockTracker.enable(enabled)
  }
}

module.exports = KitsunetRPC
