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
  return pify(rpc.wrap(Object.keys(methods)))
}
