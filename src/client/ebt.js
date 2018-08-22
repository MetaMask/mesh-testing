'use strict'

const EBT = require('epidemic-broadcast-trees')

module.exports = function createEbt (id) {
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
  p.store = store
  p.append = append
  return p
}
