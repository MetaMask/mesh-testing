'use strict'

const EBT = require('epidemic-broadcast-trees')
const pify = require('pify')

module.exports = function (id) {
  async function attemptDialEbt (peerInfo) {
    const peerId = peerInfo.id.toB58String()
    // attempt connection
    try {
      // console.log('MetaMask Mesh Testing - kitsunet dial', peerId)
      const conn = await pify(global.node.dialProtocol).call(global.node, peerInfo, '/kitsunet/test/ebt/0.0.1')
      console.log('MetaMask Mesh Testing - kitsunet-ebt dial success', peerId)
      global.ebt.request(peerId, true)
      const stream = toPull(global.ebt.createStream(peerId))
      pull(
        stream,
        pull.map(m => {
          return Buffer.from(JSON.stringify(m))
        }),
        conn,
        pull.map(m => {
          return JSON.parse(m.toString())
        }),
        stream
      )
    } catch (err) {
      console.log('MetaMask Mesh Testing - kitsunet-ebt dial failed:', peerId, err.message)
      // hangupPeer(peerInfo)
    }
  }

  const store = {}
  const clocks = {}

  function append (msg, cb) {
    store[msg.author] = store[msg.author] || []
    if (msg.sequence - 1 !== store[msg.author].length) { cb(new Error('out of order')) } else {
      store[msg.author].push(msg)
      p.onAppend(msg)
      cb(null, msg)
    }
  }

  var p = EBT({
    id: id,
    getClock: function (id, cb) {
      // load the peer clock for id.
      cb(null, clocks[id] || {})
    },
    setClock: function (id, clock) {
      // set clock doesn't have take a cb, but it's okay to be async.
      clocks[id] = clock
    },
    getAt: function (pair, cb) {
      if (!store[pair.id] || !store[pair.id][pair.sequence - 1]) {
        cb(new Error(`not found - ${pair.id}:${pair.sequence}`))
      } else {
        cb(null, store[pair.id][pair.sequence - 1])
      }
    },
    append: append
  })

  return {
    append,
    store,
    attemptDialEbt
  }
}
