const React = require('react')
const ErrorLogComponent = require('./error-log')
const { colorByErrorCount } = ErrorLogComponent

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

experiment.graphBuilder = {
  color: [
    { id: 'errors', label: 'errors', value: colorByErrorCount },
  ]
}

module.exports = experiment