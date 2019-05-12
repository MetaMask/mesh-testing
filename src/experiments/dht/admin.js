const React = require('react')
const DhtGraph = require('./graphs/routing')
const {
  topoByRoutingTable,
  colorByGroup,
} = DhtGraph

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

experiment.graphBuilder = {
  topo: [
    { id: 'dht:routingTable', label: 'dht', value: topoByRoutingTable },
  ],
  color: [
    { id: 'dht:group', label: 'dht group', value: colorByGroup },
  ]
}

module.exports = experiment