'use strict'

const pump = require('pump')
const { cbifyObj } = require('../util/cbify')
const pify = require('pify')
const multiplexRpc = require('../network/multiplexRpc')

module.exports = {
  createRpc,
  createRpcServer,
  createRpcClient,
}

function createRpc({ clientInterface, serverInterface, connection }) {
  const rpcServer = createRpcServer(clientInterface, connection)
  const rpcClient = createRpcClient(serverInterface, rpcServer)
  return rpcClient
}

function createRpcServer(rpcInterface, connection) {
  const rawInterface = cbifyObj(rpcInterface)
  const rpcServer = multiplexRpc(rawInterface)
  pump(
    connection,
    rpcServer,
    connection,
    (err) => {
      console.log(`rpc stream closed`, err)
    })
  return rpcServer
}

function createRpcClient (rpcInterface, rpcServer) {
  const methodNames = Object.keys(rpcInterface)
  const normalizedNames = methodNames.map((name) => name.match(/stream$/i) ? `${name}:s` : name)
  const rawRpcClient = rpcServer.wrap(normalizedNames)
  const rpcClient = pify(rawRpcClient)
  return rpcClient
}
