const React = require('react')
const ObsStoreComponent = require('../common/obs-store')
const DebugVersions = require('./versions')

const experiment = {
  views: [],
  actions: []
}

experiment.views.push({
  id: 'debug:state',
  label: 'debug',
  render: ({ store, actions }) => (
    <ObsStoreComponent store={store} actions={actions}/>
  )
})

experiment.views.push({
  id: 'debug:versions',
  label: 'versions',
  render: ({ store, actions }) => (
    <DebugVersions store={store} actions={actions}/>
  )
})

module.exports = experiment