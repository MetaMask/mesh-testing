const timeout = require('../util/timeout')

module.exports = handleClientTimeouts

async function handleClientTimeouts({
  clients,
  disconnectClient,
  heartBeatInterval,
  remoteCallTimeout,
}) {
  while (true) {
    try {
      await performClientTimeoutCheck()
    } catch (err) {
      console.error(err)
    }
    await timeout(heartBeatInterval)
  }

  // poll for connection status
  async function performClientTimeoutCheck() {
    // try all clients in sync
    await Promise.all(clients.map(async (client) => {
      // mark client as not responded yet
      let heardPing = false

      // race against ping response or timeout
      // console.log('timeout check - start')
      await Promise.race([
        // await ping response
        (async () => {
          await client.rpcAsync.ping()
          heardPing = true
          // console.log('timeout check - got ping', client.peerId)
        })(),
        // disconnect peer on timeout
        (async () => {
          await timeout(remoteCallTimeout)
          if (heardPing) return
          // console.log('timeout check - failed', client.peerId)
          disconnectClient(client.peerId)
        })(),
      ])
    }))
  }

}
