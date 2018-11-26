'use string'

const timeout = require('../../utils/timeout')

const log = require('debug')('kitsunet:network:ping')

module.exports = async (rpc, pingTimeout) => {
  // mark client as not responded yet
  let heardPing = false

  return Promise.race([
    // await ping response
    (async () => {
      const start = Date.now()
      await rpc.ping()
      heardPing = true
      const end = Date.now()
      const rtt = end - start
      log('timeout check - got ping')
      return rtt
    })(),
    // disconnect peer on timeout
    (async () => {
      await timeout(pingTimeout)
      if (heardPing) return
      log('timeout check - failed')
      throw new Error('ping timed out')
    })()
  ])
}
