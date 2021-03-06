
module.exports = initializeExperiment

function initializeExperiment ({ graphOptions, actions }) {
  // graph builder options
  Object.assign(graphOptions, {
    color: [
      ...graphOptions.color,
      { id: 'platform:name', label: 'platform', value: colorByPlatform },
    ],
  })
}

function colorByPlatform (appState, graph) {
  // set color based on platform
  graph.nodes.forEach(node => {
    const clientId = node.id
    const clientData = appState.clients[clientId] || {}
    const platformData = clientData.platform || {}
    const name = platformData.name
    const color = colorForPlatform(name)
    node.color = color
  })
}

function colorForPlatform (name) {
  switch (name) {
    case 'chrome':
      return 'green'
    case 'firefox':
      return 'orange'
    case 'edge':
      return 'blue'
    case 'node':
      return 'purple'
    default:
      return 'black'
  }
}