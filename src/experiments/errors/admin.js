const React = require('react')
const ErrorLogComponent = require('./error-log')

const experiment = {
  views: [],
  actions: []
}

experiment.views.push({
  id: 'errors',
  label: 'errors',
  render: ({ store }) => (
    <ErrorLogComponent store={store}/>
  )
})

module.exports = experiment