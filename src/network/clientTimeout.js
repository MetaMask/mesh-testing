const timeout = require('../util/timeout')

module.exports = { pingAllClientsOnInterval, pingClientWithTimeout }

async function pingAllClientsOnInterval ({
  clients,
  disconnectClient,
  heartBeatInterval,
  pingTimeout
}) {
  while (true) {
    try {
      await pingClientsWithTimeout()
    } catch (err) {
      console.error(err)
    }
    await timeout(heartBeatInterval)
  }

  // poll for connection status
  async function pingClientsWithTimeout () {
    // try all clients in sync
    await Promise.all(clients.map(async (client) => {
      return pingClientWithTimeout({ client, disconnectClient, pingTimeout })
    }))
  }
}

async function pingClientWithTimeout ({ client, disconnectClient, pingTimeout }) {
  // mark client as not responded yet
  let heardPing = false

  // race against ping response or timeout
  // console.log('timeout check - start')
  return Promise.race([
    // await ping response
    (async () => {
      const start = Date.now()
      const pong = await client.rpcAsync.ping()
      console.log(`heard response '${pong}' from peer: ${client.peerId}`)
      heardPing = true
      const end = Date.now()
      const rtt = end - start
      return rtt
      // console.log('timeout check - got ping', client.peerId)
    })(),
    // disconnect peer on timeout
    (async () => {
      await timeout(pingTimeout)
      if (heardPing) return
      // console.log('timeout check - failed', client.peerId)
      disconnectClient(client)
    })()
  ])
}
