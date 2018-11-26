'use strict'

const assert = require('assert')
const SafeEventEmitter = require('safe-event-emitter')
const toStream = require('pull-stream-to-stream')
const endOfStream = require('end-of-stream')

const rpc = require('./rpc')
const baseRpc = require('./interfaces/base')

const { sec, min } = require('../utils/time')

const log = require('debug')('kitsunet:telemetry:client')

const DEFAULT_SUBMIT_INTERVAL = 15 * sec

const clientState = {
  // kitsunet peers
  peers: {}, // {}
  // libp2p stats
  stats: {},
  multicast: [],
  block: {},
  blockTrackerEnabled: false
}

const pingWithTimeout = require('./network/pingWithTimeout')

const peerPingInterval = 1 * min
const peerPingTimeout = 40 * sec

async function pingPeer ({ rpc, kitsunetPeer, peerInfo }) {
  const b58Id = peerInfo.id.toB58String()
  try {
    const time = await pingWithTimeout(rpc, peerPingTimeout)
    let status = clientState.peers[b58Id]
    status = status || { status: '', ping: '' }
    status.ping = time
    status.status = 'connected'
    log(`successfully pinged ${b58Id}`)
  } catch (err) {
    log(`got error pinging ${b58Id}, hanging up`, err)
    return kitsunetPeer.hangup(peerInfo)
  }

  setTimeout(() => {
    pingPeer({ rpc, kitsunetPeer, peerInfo })
  }, peerPingInterval)
}

class TelemetryClient extends SafeEventEmitter {
  constructor ({ stats, telemetryRpc, submitInterval, kitsunetPeer, node }) {
    super()

    assert(telemetryRpc, 'telemetryRpc required')
    assert(node, 'node required')
    assert(node, 'kitsunetPeer required')

    this.stats = stats
    this.telemetryRpc = telemetryRpc
    this.submitInterval = submitInterval || DEFAULT_SUBMIT_INTERVAL
    this.started = false
    this.node = node

    kitsunetPeer.on('kitsunet:connect', (peerInfo) => {
      this.addPeer(peerInfo)
      log(`peer connected ${peerInfo.id.toB58String()}`)
    })

    kitsunetPeer.on('kitsunet:disconnect', (peerInfo) => {
      this.removePeer(peerInfo)
    })

    kitsunetPeer.on('kitsunet:connection', (conn) => {
      conn.getPeerInfo((err, peerInfo) => {
        if (err) {
          return log(err)
        }

        const stream = toStream(conn)
        endOfStream(stream, (err) => {
          log(`peer rpcConnection disconnect ${peerInfo.id.toB58String()}`, err.message)
          kitsunetPeer.hangup(peerInfo)
        })

        const kitsunetPeerRpc = rpc.createRpcServer(baseRpc(), stream)
        pingPeer({ rpc: rpc.createRpcClient(baseRpc(), kitsunetPeerRpc), kitsunetPeer, peerInfo })
      })
    })
  }

  start () {
    this.stats.start()
    this.started = true
    this.telemetryRpc.setPeerId(this.node.peerId)
    this.submitClientStateOnInterval()
  }

  stop () {
    this.stats.stop()
    this.started = false
    this.telemetryRpc.disconnectPeer(this.node.peerId)
  }

  async submitClientStateOnInterval () {
    if (!this.started) return

    setTimeout(async () => {
      try {
        await this.submitNetworkState()
      } catch (err) {
        log(err)
      }
      this.submitClientStateOnInterval()
    }, this.submitInterval)
  }

  async submitNetworkState () {
    clientState.stats = this.stats.stats
    return this.telemetryRpc.submitNetworkState(clientState)
  }

  async addPeer (peerInfo) {
    const b58Id = peerInfo.id.toB58String()
    clientState.peers[b58Id] = { status: 'connected' }
    this.stats.addPeer(b58Id)
  }

  async removePeer (peerInfo) {
    const b58Id = peerInfo.id.toB58String()
    delete clientState.peers[b58Id]
    this.stats.removePeer(b58Id)
  }
}

module.exports = TelemetryClient
