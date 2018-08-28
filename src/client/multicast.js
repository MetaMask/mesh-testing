'use strict'

const createMulticast = require('libp2p-multicast-experiment/src/api')

module.exports = function (client, node, clientState) {
  const multicast = createMulticast(node)

  function publish (message, hops) {
    multicast.publish('kitsunet-test2', Buffer.from(message, 'utf8'), hops, (err) => {
      console.log(`multicast published "${message}"`, err)
    })
  }

  node.multicast = multicast
  node._multicast.start(() => {
    multicast.subscribe('kitsunet-test2', (message) => {
      const { from, data, seqno, hops, topicIDs } = message
      console.log(`multicast message on "kitsunet-test2" from ${from}: ${data.toString()}`)
      // record message in client state
      clientState.multicast.push({
        from,
        data: data.toString(),
        seqno: seqno.toString(),
        hops,
        topicIDs
      })
      // publish new data to server
      client.submitNetworkState()
    }, (err) => {
      console.log('subscribed to "kitsunet-test1"', err)
    })

    multicast.subscribe('block-header', (message) => {
      const { from, data } = message

      let blockHeader = null
      try {
        blockHeader = JSON.parse(data.toString())
      } catch (err) {
        console.error(err)
        return
      }

      blockHeader = blockHeader || {}
      if (blockHeader.number && Number(blockHeader.number) <= Number(clientState.block.number)) return
      clientState.block = blockHeader

      console.log(`got new block header from ${from}`)
      // publish new data to server
      client.submitNetworkState()
    }, (err) => {
      console.log('subscribed to "kitsunet-test1"', err)
    })
  })

  return {
    publish
  }
}
