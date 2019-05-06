const { util: { createNode, createLink } } = require('react-force-directed')

module.exports = {
  buildGraphBasicNodes,
  buildGraphAddMissingNodes,
}

function buildGraphBasicNodes (networkState, graph) {
  // adds a node for each reporting client
  Object.keys(networkState).forEach((clientId) => {
    const newNode = createNode({ id: clientId, color: 'blue' })
    graph.nodes.push(newNode)
  })
}

function buildGraphAddMissingNodes (graph, _color) {
  const color = _color || 'orange'
  graph.links.forEach((link) => {
    const { target } = link
    // if connected to a missing node, create missing node
    const alreadyExists = !!graph.nodes.find(item => item.id === target)
    if (!alreadyExists) {
      const newNode = createNode({ id: target, color })
      graph.nodes.push(newNode)
    }
  })
}