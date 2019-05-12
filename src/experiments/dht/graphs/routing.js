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
    const { includeMissing } = this.props
    return buildGraphForDht(state, { includeMissing })
  }

}

module.exports = DhtGraph
module.exports.topoByRoutingTable = topoByRoutingTable
module.exports.colorByGroup = colorByGroup


function buildGraphForDht (appState, opts = {}) {
  const graph = { nodes: [], links: [] }

  const clientsData = appState.clients
  if (!clientsData) return graph
  
  topoByRoutingTable(appState, graph, opts)
  colorByGroup(appState, graph)
  return graph
}

function topoByRoutingTable (appState, graph, opts = {}) {
  const { includeMissing } = opts

  const clientsData = appState.clients
  buildGraphBasicNodes(clientsData, graph)
  buildGraphDhtLinks(clientsData, graph, includeMissing)

  return graph
}

function buildGraphDhtLinks (clientsData, graph, includeMissing) {
  // build links from stats
  Object.entries(clientsData).forEach(([clientId, clientData]) => {
    const dhtData = clientData.dht || {}
    const peers = dhtData.routingTable
    if (!peers) return

    const links = []
    peers.forEach(({ id: peerId }) => {
      const source = clientId
      const target = peerId
      if (!includeMissing) {
        const isMissing = !graph.nodes.find(peer => peer.id === target)
        if (isMissing) return
      }
      links.push(createLink({
        source,
        target,
      }))
    })

    graph.links = graph.links.concat(links)
  })

  if (includeMissing) {
    buildGraphAddMissingNodes(graph, 'red')
  }
}

function colorByGroup (appState, graph) {
  const clientsData = appState.clients
  graph.nodes.forEach((node) => {
    const clientId = node.id
    const clientData = clientsData[clientId] || {}
    const dhtData = clientData.dht || {}
    const groupName = dhtData.group
    if (!groupName) {
      node.color = 'black'
      return
    }
    const number = Number(groupName.split('-')[1])
    const color = colors[number % colors.length]
    node.color = color
  })
}