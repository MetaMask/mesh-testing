const React = require('react')
const ObsStoreComponent = require('../common/obs-store')

const experiment = {
  views: [],
  actions: []
}

experiment.views.push({
  id: 'dht',
  label: 'dht',
  render: ({ store }) => (
    <ObsStoreComponent store={store}/>
  )
})

experiment.views.push({
  id: 'dht:2',
  label: 'dht traffic',
  render: () => 'dht but different'
})

module.exports = experiment