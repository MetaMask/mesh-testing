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
      internals: {},
      providers: {
        all: [],
        group1: [],
        group2: [],
        group3: [],
      },
    }

    this.start()
  }

  async start () {
    const { node } = this

    // static
    this.providedContent = ['all']
    // group (1-3)
    const groupNumber = 1 + Math.floor(3*Math.random())
    this.providedContent.push(`group${groupNumber}`)

    this.precomputedCids = {
      all: await makeKeyId(Buffer.from('all')),
      group1: await makeKeyId(Buffer.from('group1')),
      group2: await makeKeyId(Buffer.from('group2')),
      group3: await makeKeyId(Buffer.from('group3')),
    }

    while (true) {
      try {
        // broadcast that we provide content
        await this.announceProvidedContent()
        // look for others with matching content
        await this.findProviders()
        this.state.internals = getStats({ node })
      } catch (err) {
        console.warn(err)
      }
      await timeout(10 * 1000)
    }
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