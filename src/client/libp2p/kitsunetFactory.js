'use strict'

const JsonRpcEngine = require('json-rpc-engine')
const createVmMiddleware = require('eth-json-rpc-middleware/vm')
const createBlockRefRewriteMiddleware = require('eth-json-rpc-middleware/block-ref-rewrite')
const createAsyncMiddleware = require('json-rpc-engine/src/createAsyncMiddleware')
const createBlockCacheMiddleware = require('eth-json-rpc-middleware/block-cache')
const createSliceMiddleware = require('eth-json-rpc-kitsunet-slice')
const scaffold = require('eth-json-rpc-middleware/scaffold')

const utils = require('ethereumjs-util')

const createKitsunet = require('kitsunet')

module.exports = async function (options) {
  // create higher level
  const engine = new JsonRpcEngine()
  const provider = providerFromEngine(engine)

  // if a blockTracker is provided it will fetch and
  // publish blocks on the kitsunet network
  const kitsunet = await createKitsunet(options.options)

  const ksnBlockTracker = {
    async getLatestBlock () {
      const block = await kitsunet.getLatestBlock()
      if (block) return utils.addHexPrefix(block.header.number.toString('hex'))
    }
  }

  // add handlers
  engine.push(createBlockMiddleware({ kitsunet }))
  engine.push(createBlockCacheMiddleware({ blockTracker: ksnBlockTracker, provider }))
  engine.push(createBlockRefRewriteMiddleware({ blockTracker: ksnBlockTracker }))
  engine.push(createSliceMiddleware({ kitsunet, depth: options.options.sliceDepth }))
  engine.push(createVmMiddleware({ provider }))

  return {
    engine,
    provider,
    blockTracker: kitsunet.blockTracker,
    kitsunet
  }
}

function createBlockMiddleware ({ kitsunet }) {
  return scaffold({
    eth_getBlockByNumber: createAsyncMiddleware(async (req, res, next) => {
      const [blockRef] = req.params
      let block = null
      if (blockRef === 'latest') {
        block = await kitsunet.getLatestBlock()
      } else {
        block = await kitsunet.getBlockByNumber(blockRef, false)
      }

      if (!block) return next()
      const jsonHeader = (block.toJSON(true)).header
      res.result = {
        parentHash: jsonHeader.parentHash,
        sha3Uncles: jsonHeader.uncleHash,
        miner: jsonHeader.coinbase,
        stateRoot: jsonHeader.stateRoot,
        transactionsRoot: jsonHeader.transactionsTrie,
        receiptRoot: jsonHeader.receiptTrie || utils.SHA3_NULL,
        logsBloom: jsonHeader.bloom,
        difficulty: jsonHeader.difficulty,
        number: jsonHeader.number,
        gasLimit: jsonHeader.gasLimit,
        gasUsed: jsonHeader.gasUsed,
        timestamp: jsonHeader.timestamp,
        extraData: jsonHeader.extraData,
        mixHash: jsonHeader.mixHash,
        nonce: jsonHeader.nonce
      }
    })
  })
}

function providerFromEngine (engine) {
  const provider = { sendAsync: engine.handle.bind(engine) }
  return provider
}