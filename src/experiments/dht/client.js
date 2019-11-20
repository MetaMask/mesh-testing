'use strict'
const pify = require('pify')
const CID = require('cids')
const multihashing = require('multihashing-async')
const PeerId = require('peer-id')
const getStats = require('./getDhtStats')
const timeout = (duration) => new Promise(resolve => setTimeout(resolve, duration))


class DhtExperimentClient {
  constructor ({ node, clientId, rpcInterface, setState }) {
    this.node = node
    this.clientId = clientId
    this.state = {
      routingTable: [],
      providers: {},
    }

    rpcInterface.dht = {
      enableRandomWalk: async () => {
        if (!this.node._dht) throw new Error('Dht doesnt exist') 
        // https://github.com/libp2p/js-libp2p-kad-dht/issues/110
        this.node._dht.randomWalk._options.enabled = true
        this.node._dht.randomWalk.start()
      },
      findProviders: async (key) => {
        console.log('dht findProviders query starting...')
        if (!this.node._dht) throw new Error('Dht doesnt exist')
        const cid = await makeKeyId(Buffer.from(key))
        const start = Date.now()
        const { result: providers, queryStats: query } = await node._dht._findNProvidersWithStatsAsync(cid, 10 * 1e3, 20)
        // map to id strings
        const providerIds = (providers || []).map(provider => provider.id.toB58String())
        const time = Date.now() - start
        console.log('dht findProviders query completed!')
        return { time, result: providerIds, query }
      },
    }

    this.start()
  }

  async start () {
    const { node, clientId } = this

    this.peerIdHashString = await peerIdStringToPeerIdHashString(clientId)

    await this.prepareGroups({ count: 100 })
    
    while (true) {
      try {
        // broadcast that we provide content
        await this.announceProvidedContent()
        // // look for others with matching content
        // await this.findProviders()
        Object.assign(this.state, getStats({ node }))
      } catch (err) {
        this.reportError('main loop', err)
      }
      await timeout(10 * 1000)
    }

    // // start random walk
    // node._dht.randomWalk._options.enabled = true
    // node._dht.randomWalk.start()
  }

  reportError (label, err) {
    this.node.emit('app:error', `dht - ${label}`, err)
  }

  async prepareGroups ({ count }) {
    // static
    this.providedContent = ['all']
    // group number
    const number = 1 + Math.floor(count*Math.random())
    const key = `group-${number}`
    this.state.group = key
    this.providedContent.push(`group-${number}`)
  
    this.precomputedCids = {}
  
    await Promise.all(
      this.providedContent.map(async (key) => {
        const value = await makeKeyId(Buffer.from(key))
        this.precomputedCids[key] = value
      })
    )
  }

  async announceProvidedContent () {
    const { node } = this
    // // static key
    // node.dht.put(Buffer.from('all'), Buffer.from(clientId), (err, result) => console.log('dht put (all)', err || result))
    // // unique but predictable
    // node.dht.put(Buffer.from(clientId), Buffer.from('it me'), (err, result) => console.log('dht put (clientId)', err || result))
    // // unique and random
    // node.dht.put(Buffer.from(Math.random().toString()), Buffer.from('correct'), (err, result) => console.log('dht put (random)', err || result))
    await Promise.all(
      this.providedContent.map(async (key) => {
        try {
          const cid = this.precomputedCids[key]
          await pify(cb => node.contentRouting.provide(cid, cb))()
        } catch (err) {
          this.reportError(`provide content "${key}"`, err)
        }
      })
    )
  }

  // async findProviders () {
  //   const { clientId, node } = this
  //   await Promise.all(
  //     Object.entries(this.precomputedCids).map(async ([key, cid]) => {
  //       try {
  //         const providers = await pify(cb => node.contentRouting.findProviders(cid, 10 * 1000, cb))()
  //         // map to id strings
  //         const providerIds = providers.map(provider => provider.id.toB58String())
  //         // remove self
  //         const providerPeerIds = providerIds.filter(providerId => clientId !== providerId)
  //         // update state
  //         this.state.providers[key] = providerPeerIds
  //       } catch (err) {
  //         this.reportError('find providers', err)
  //       }
  //     })
  //   )
  // }

  getState () {
    const baseState = this.state
    const dht = this.node._dht
    const randomWalkEnabled = dht && dht.randomWalk._options.enabled
    const state = Object.assign({}, baseState, {
      peerIdHash: this.peerIdHashString,
      randomWalkEnabled,
    })
    return state
  }
}

module.exports = DhtExperimentClient

async function makeKeyId (content) {
  const key = await pify(multihashing)(content, 'sha2-256')
  return new CID(key)
}

async function peerIdStringToPeerIdHashString (peerIdString) {
  const peerId = PeerId.createFromB58String(peerIdString)
  const hash = await pify(cb => multihashing.digest(peerId.id, 'sha2-256', cb))()
  return hash.toString('base64')
}