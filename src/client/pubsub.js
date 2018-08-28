'use strict'

module.exports = function (client, node, clientState) {
  function publish (message) {
    node.pubsub.publish('kitsunet-test1', Buffer.from(message, 'utf8'), (err) => {
      console.log(`pubsub published "${message}"`, err)
    })
  }

  // setup pubsub
  node.pubsub.subscribe('kitsunet-test1', (message) => {
    const { from, data, seqno, topicIDs } = message
    console.log(`pubsub message on "kitsunet-test1" from ${from}: ${data.toString()}`)
    // record message in client state
    clientState.pubsub.push({
      from,
      data: data.toString(),
      seqno: seqno.toString(),
      topicIDs
    })
    // publish new data to server
    client.submitNetworkState()
  }, (err) => {
    console.log('subscribed to "kitsunet-test1"', err)
  })

  return {
    publish
  }
}
