const React = require('react')
const DhtGraph = require('./graphs/routing')

const experiment = {
  views: [],
  actions: []
}

experiment.views.push({
  id: 'dht:active',
  label: 'dht',
  render: ({ store }) => (
    <DhtGraph store={store}/>
  )
})

experiment.views.push({
  id: 'dht:missing',
  label: 'dht full',
  render: ({ store }) => (
    <DhtGraph store={store} includeMissing={true}/>
  )
})

module.exports = experiment