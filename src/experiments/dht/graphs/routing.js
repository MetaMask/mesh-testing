const palette = require('google-palette')
const { util: { createNode, createLink } } = require('react-force-directed')
const BaseForceGraph = require('../../common/BaseForceGraph')
const {
  buildGraphBasicNodes,
  buildGraphAddMissingNodes,
} = require('../../common/graph-viz')

const colors = palette('tol-rainbow', 5).map(hex => `#${hex}`)


class DhtGraph extends BaseForceGraph {

  buildGraph (state) {
    return buildGraphForDht(state)
  }

}

module.exports = DhtGraph


function buildGraphForDht (appState) {
  const graph = { nodes: [], links: [] }

  // const { networkState, selectedNode } = appState
  const clientsData = appState.clients
  if (!clientsData) return graph

  buildGraphBasicNodes(clientsData, graph)
  buildGraphDhtLinks(clientsData, graph)

  // recolor nodes based on group
  // color green if they were part of the getMany response
  recolorNodesForGroupNumber(clientsData, graph)

  return graph
}

function buildGraphDhtLinks (networkState, graph) {
  // build links from stats
  Object.entries(networkState).forEach(([clientId, clientData]) => {
    const dhtData = clientData.dht || {}
    const peers = dhtData.routingTable
    if (!peers) return

    const links = peers.map(({ id: peerId }) => {
      const source = clientId
      const target = peerId
      return createLink({
        source,
        target,
      })
    })

    graph.links = graph.links.concat(links)
  })

  buildGraphAddMissingNodes(graph)
}

function recolorNodesForGroupNumber (clientsData, graph) {
  graph.nodes.map((node) => {
    const clientId = node.id
    const clientData = clientsData[clientId] || {}
    const dhtData = clientData.dht || {}
    const groupName = dhtData.group
    if (!groupName) return
    const number = Number(groupName.split('-')[1])
    const color = colors[number % colors.length]
    node.color = color
  })
}