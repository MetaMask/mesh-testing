const timeout = require('../util/timeout')
const pify = require('pify')

class DhtExperiment {
  constructor ({ node, clientId }) {
    this.node = node
    this.state = {
      hello: [],
    }

    node.dht.put(Buffer.from('hello'), Buffer.from(clientId), (err, result) => console.log('dht put (hello)', err || result))
    node.dht.put(Buffer.from(clientId), Buffer.from('it me'), (err, result) => console.log('dht put (clientId)', err || result))
    node.dht.put(Buffer.from(Math.random().toString()), Buffer.from('correct'), (err, result) => console.log('dht put (random)', err || result))

    this.start()
  }

  async start() {
    const node = this.node

    while (true) {
      await timeout(10 * 1000)
      try {
        // gather results for "hello" lookup
        const results = await pify((cb) => node.dht.getMany(Buffer.from('hello'), 12, cb))()
        this.state.hello = results.map(result => ({
          from: result.from.toB58String(),
          value: result.val.toString(),
        }))
      } catch (err) {
        console.warn(err)
      }
    }
  }

  getState () {
    return this.state
  }

}

module.exports = DhtExperiment
