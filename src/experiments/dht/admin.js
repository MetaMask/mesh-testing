const React = require('react')
const ObsStoreComponent = require('../common/obs-store')
const DhtGraph = require('./graph')

const experiment = {
  views: [],
  actions: []
}

experiment.views.push({
  id: 'dht',
  label: 'dht',
  render: ({ store }) => (
    <DhtGraph store={store}/>
  )
})

experiment.views.push({
  id: 'dht:2',
  label: 'dht traffic',
  render: ({ store }) => (
    <ObsStoreComponent store={store}/>
  )
})

module.exports = experiment