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
module.exports.topoByTraffic = topoByTraffic


function buildGraph (appState) {
  const graph = { nodes: [], links: [] }

  // const { networkState, selectedNode } = appState
  const clientsData = appState.clients
  if (!clientsData) return graph

  topoByTraffic(appState, graph)

  return graph
}

function topoByTraffic (appState, graph) {
  const clientsData = appState.clients
  buildGraphBasicNodes(clientsData, graph)
  buildGraphLinks(clientsData, graph)
}

function buildGraphLinks (clientsData, graph, networkFilter) {
  // build links from stats
  Object.entries(clientsData).forEach(([clientId, clientData]) => {
    const clientTrafficStats = clientData.traffic || {}
    const peers = clientTrafficStats.peers
    if (!peers) return

    let links = Object.entries(peers).map(([peerId, peerStats]) => {
      const source = clientId
      const target = peerId
      return createLink({ source, target })
    })
    // filter by protocol name
    if (networkFilter) {
      links = links.filter(({ target }) => {
        const peerStats = peers[target]
        const protocolNames = Object.keys(peerStats.protocols)
        return protocolNames.some(name => name.includes(networkFilter))
      })
    }

    graph.links = graph.links.concat(links)
  })

  buildGraphAddMissingNodes(graph)
}
