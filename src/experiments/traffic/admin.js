const BasicTrafficGraph = require('./basic')
const { topoByTraffic } = BasicTrafficGraph

module.exports = initializeExperiment

function initializeExperiment ({ graphOptions, actions }) {
  // graph builder options
  Object.assign(graphOptions, {
    topo: [
      ...graphOptions.topo,
      { id: 'traffic:peers', label: 'traffic', value: topoByTraffic },
    ],
  })
}
