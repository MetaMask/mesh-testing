'use strict'

const pump = require('pump')
const { cbifyObj } = require('../util/cbify')
var multiplex = require('multiplex')
const rpcStream = require('rpc-stream')

exports.createRpcServer = function (methods, conn) {
  const rpc = rpcStream(cbifyObj(methods))
  const mx = multiplex({ chunked: true })
  const stream = pump(
    rpc,
    mx.createSharedStream('0'),
    rpc
  )
  pump(stream, conn, stream)
  return methods
}

exports.createRpcClient = function (methods, conn) {
  const rpc = rpcStream()
  const mx = multiplex({ chunked: true })
  const stream = pump(
    rpc,
    mx.createSharedStream('1'),
    rpc
  )
  pump(stream, conn, stream)
  return rpc.wrap(cbifyObj(methods))
}
