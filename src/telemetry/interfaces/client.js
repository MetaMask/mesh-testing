'use strict'

const base = require('./base')
const assert = require('assert')
const { sec, min } = require('../../util/time')
const randomFromRange = require('../../util/randomFromRange')


module.exports = function ({ restart }) {
  assert(restart, 'must provide restart function')

  return Object.assign(base(), {
    refresh: async () => {
      return restart()
    },
    refreshShortDelay: () => {
      return restartWithDelay(randomFromRange(5 * sec, 10 * sec))
    },
    refreshLongDelay: async () => {
      return restartWithDelay(randomFromRange(2 * min, 10 * min))
    }
  })

  async function restartWithDelay (timeoutDuration) {
    console.log(`MetaMask Mesh Testing - restarting in ${timeoutDuration / 1000} sec...`)
    setTimeout(() => restart(), timeoutDuration)
  }
}
