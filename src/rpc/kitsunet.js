'use strict'

const base = require('./base')

const { sec, min } = require('../util/time')
const randomFromRange = require('../util/randomFromRange')

module.exports = function (client, multicast, pubsub, ebt, blockTracker) {
  return Object.assign({}, {
    refresh: async () => {
      return client.restart()
    },
    refreshShortDelay: () => {
      return client.restartWithDelay(randomFromRange(5 * sec, 10 * sec))
    },
    refreshLongDelay: async () => {
      return client.restartWithDelay(randomFromRange(2 * min, 10 * min))
    },
    pubsubPublish: async (message) => {
      return pubsub.publish(message)
    },
    multicastPublish: async (message, hops) => {
      return multicast.publish(message, hops)
    },
    ebtAppend: async (message) => {
      return ebt.append(message)
    },
    enableBlockTracker: async (enabled) => {
      return blockTracker.enable(enabled)
    }
  }, base())
}
