const { colorByErrorCount } = require('./error-log')

module.exports = initializeExperiment


function initializeExperiment ({ graphOptions, actions }) {
  // graph builder options
  Object.assign(graphOptions, {
    color: [
      ...graphOptions.color,
      { id: 'errors', label: 'errors', value: colorByErrorCount },
    ],
  })
}