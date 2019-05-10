const { util: { createNode, createLink } } = require('react-force-directed')
const {
  buildGraphBasicNodes,
  buildGraphAddMissingNodes,
} = require('../common/graph-viz')
const BaseForceGraph = require('../common/BaseForceGraph')

class BasicTrafficGraph extends BaseForceGraph {

  buildGraph (state) {
    return buildGraph(state)
  }

}
 
module.exports = BasicTrafficGraph


function buildGraph (appState) {
  const graph = { nodes: [], links: [] }

  // const { networkState, selectedNode } = appState
  const clientsData = appState.clients
  if (!clientsData) return graph

  const clientsDataEntries = Object.entries(clientsData)

  const versions = getVersionsFromClientsDataEntries(clientsDataEntries)

  // create nodes and set color based on version age
  clientsDataEntries.forEach(([clientId, clientData]) => {
    const { version } = clientData
    const color = colorForVersion(version, versions)
    const newNode = createNode({ id: clientId, color })
    graph.nodes.push(newNode)
  })

  buildGraphLinks(clientsDataEntries, graph)

  return graph
}

function getVersionsFromClientsDataEntries (clientsDataEntries) {
  const versionSet = new Set()
  clientsDataEntries.forEach(([clientId, clientsData]) => {
    if (!clientsData.version) return
    if (clientsData.version === 'development') return
    versionSet.add(clientsData.version)
  })
  const sorted = Array.from(versionSet.values()).sort().reverse()
  return sorted
}

function colorForVersion (version, versions) {
  if (version === 'development') {
    return 'purple'
  }
  const versionIndex = versions.indexOf(version)
  switch (versionIndex) {
    case 0:
      return 'green'
    case 1:
      return 'yellow'
    case 2:
      return 'orange'
    default:
      return 'red'
  }
}

// mostly same as traffic
function buildGraphLinks (clientsDataEntries, graph, networkFilter) {
  // build links from stats
  clientsDataEntries.forEach(([clientId, clientData]) => {
    const clientTrafficStats = clientData.traffic || {}
    const peers = clientTrafficStats.peers
    if (!peers) return

    let links = Object.entries(peers).map(([peerId, peerStats]) => {
      const source = clientId
      const target = peerId
      return createLink({ source, target })
    })

    graph.links = graph.links.concat(links)
  })

  buildGraphAddMissingNodes(graph, 'black')
}
