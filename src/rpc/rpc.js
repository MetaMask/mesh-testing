'use strict'

const pump = require('pump')
const { cbifyObj } = require('../util/cbify')
const pify = require('pify')
const multiplexRpc = require('../network/multiplexRpc')

exports.createRpcServer = function (methods, conn) {
  const rpc = multiplexRpc(cbifyObj(methods))
  pump(
    conn,
    rpc,
    conn,
    (err) => {
      console.log(`stream closed`, err)
    })
  return rpc
}

exports.createRpcClient = function (methods, rpc) {
  const m = Object.keys(methods)
  return pify(rpc.wrap(m.map((name) => name.match(/stream$/i)
    ? `${name}:s`
    : name)))
}
