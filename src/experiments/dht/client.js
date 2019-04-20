'use strict'
const pify = require('pify')
const CID = require('cids')
const multihashing = require('multihashing-async')
const getStats = require('./getDhtStats')
const timeout = (duration) => new Promise(resolve => setTimeout(resolve, duration))


class DhtExperimentClient {
  constructor ({ node, clientId }) {
    this.node = node
    this.clientId = clientId
    this.state = {
      routingTable: [],
      providers: {},
    }

    this.start()
  }

  async start () {
    const { node } = this

    await this.prepareGroups({ count: 3 })
    
    while (true) {
      try {
        // broadcast that we provide content
        await this.announceProvidedContent()
        // look for others with matching content
        await this.findProviders()
        Object.assign(this.state, getStats({ node }))
      } catch (err) {
        console.warn(err)
      }
      await timeout(10 * 1000)
    }
  }

  async prepareGroups ({ count }) {
    // static
    this.providedContent = ['all']
    // group number
    const number = 1 + Math.floor(count*Math.random())
    const key = `group-${number}`
    this.state.group = key
    this.providedContent.push(`group-${number}`)
  
    this.precomputedCids = {
      all: await makeKeyId(Buffer.from('all')),
    }
  
    await Promise.all(
      Array(count).fill().map(async (_, index) => {
        const number = index + 1
        const key = `group-${number}`
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
        const cid = this.precomputedCids[key]
        await pify(cb => node.contentRouting.provide(cid, cb))()
      })
    )
  }

  async findProviders () {
    const { clientId, node } = this
    await Promise.all(
      Object.entries(this.precomputedCids).map(async ([key, cid]) => {
        const providers = await pify(cb => node.contentRouting.findProviders(cid, 10 * 1000, cb))()
        // map to id strings
        const providerIds = providers.map(provider => provider.id.toB58String())
        // remove self
        const providerPeerIds = providerIds.filter(providerId => clientId !== providerId)
        // update state
        this.state.providers[key] = providerPeerIds
      })
    )
  }

  getState () {
    return this.state
  }
}

module.exports = DhtExperimentClient

async function makeKeyId (content) {
  const key = await pify(multihashing)(content, 'sha2-256')
  return new CID(key)
}
