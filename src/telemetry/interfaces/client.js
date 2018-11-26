'use strict'

const base = require('./base')

const { sec, min } = require('../../util/time')
const randomFromRange = require('../../util/randomFromRange')

const isNode = require('detect-node')

async function restartWithDelay (timeoutDuration) {
  console.log(`MetaMask Mesh Testing - restarting in ${timeoutDuration / 1000} sec...`)
  setTimeout(() => restart(), timeoutDuration)
}

async function restart () {
  if (isNode) {
    console.warn('restart requested from telemetry server...')
    return
  }
  window.location.reload()
}

module.exports = function () {
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
}
