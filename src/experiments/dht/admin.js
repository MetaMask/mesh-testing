const React = require('react')
const ObsStoreComponent = require('../common/obs-store')
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

experiment.views.push({
  id: 'debug',
  label: 'debug',
  render: ({ store, actions }) => (
    <ObsStoreComponent store={store} actions={actions}/>
  )
})

module.exports = experiment