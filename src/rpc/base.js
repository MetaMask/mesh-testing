'use strict'

const pump = require('pump')
const { cbifyObj } = require('../util/cbify')
var multiplex = require('multiplex')
const rpcStream = require('rpc-stream')

const classToObj = (object, ctx) => {
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

class BaseRPC {
  constructor (conn, initiator) {
    this._conn = conn
    this._initiator = initiator || false
    const rpcMethods = cbifyObj(classToObj(this, this))
    const rpc = initiator
      ? rpcStream()
      : rpcStream(rpcMethods)
    if (initiator) this._remote = rpc.wrap(rpcMethods)
    const mx = multiplex({ chunked: true })
    const stream = pump(
      rpc,
      initiator ? mx.createSharedStream('0') : mx.createSharedStream('1'),
      rpc
    )
    pump(stream, conn, stream)
  }

  async _execRpc (name, handler, ...args) {
    if (this._initiator) return this._remote[name].apply(this, args)
    return handler.call(this)
  }

  async ping () {
    return this._execRpc('ping', async () => 'pong')
  }
}

module.exports = BaseRPC
