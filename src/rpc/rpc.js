'use strict'

const pump = require('pump')
const { cbifyObj } = require('../util/cbify')
var multiplex = require('multiplex')
const rpcStream = require('rpc-stream')

const BaseRPC = require('./base')

const instanceToObj = (object, ctx) => {
  let methods = {}
  while (Object.getPrototypeOf(object) instanceof BaseRPC ||
    Object.getPrototypeOf(object) === BaseRPC.prototype) {
    object = Object.getPrototypeOf(object)
    methods = Object.assign({}, methods, Object.keys(Object.getOwnPropertyDescriptors(object))
      .filter(k => k !== 'constructor' && k[0] !== '_')
      .reduce((obj, k) => { obj[k] = object[k].bind(ctx); return obj }, {}))
  }
  return methods
}

exports.createRpc = function createRpc (instance, conn, initiator) {
  initiator = initiator || false
  if (typeof instance === 'function') {
    const Clazz = instance
    instance = new Clazz()
    initiator = true
  }
  const rpcMethods = cbifyObj(instanceToObj(instance, instance))
  const rpc = initiator
    ? rpcStream()
    : rpcStream(rpcMethods)
  const methods = initiator ? rpc.wrap(rpcMethods) : instance
  const mx = multiplex({ chunked: true })
  const stream = pump(
    rpc,
    initiator ? mx.createSharedStream('0') : mx.createSharedStream('1'),
    rpc
  )
  pump(stream, conn, stream)
  return methods
}
