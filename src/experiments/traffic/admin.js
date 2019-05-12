const React = require('react')
const BasicTrafficGraph = require('./basic')
const { topoByTraffic } = BasicTrafficGraph

const experiment = {
  views: [],
  actions: []
}

experiment.views.push({
  id: 'traffic',
  label: 'traffic',
  render: ({ store, actions }) => (
    <BasicTrafficGraph store={store} actions={actions}/>
  )
})

experiment.graphBuilder = {
  topo: [
    { id: 'traffic:peers', label: 'traffic', value: topoByTraffic },
  ],
}


module.exports = experiment