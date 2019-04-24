const React = require('react')
const BasicTrafficGraph = require('./basic')

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

module.exports = experiment