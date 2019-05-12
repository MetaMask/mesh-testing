const { util: { createNode, createLink } } = require('react-force-directed')
const {
  buildGraphBasicNodes,
  buildGraphAddMissingNodes,
} = require('../common/graph-viz')
const {
  interpolateColor, rgbToHex
} = require('../../util/colorUtils')
const BaseForceGraph = require('../common/BaseForceGraph')
const ms2Hours = 2 * 60 * 60 * 1000

class BasicTrafficGraph extends BaseForceGraph {

  buildGraph (state) {
    return buildGraph(state)
  }

}
 
module.exports = BasicTrafficGraph
module.exports.colorByUptime = colorByUptime


function buildGraph (appState) {
  const graph = { nodes: [], links: [] }

  // const { networkState, selectedNode } = appState
  const clientsData = appState.clients
  if (!clientsData) return graph

  const clientsDataEntries = Object.entries(clientsData)

  // create nodes and set color based on version age
  clientsDataEntries.forEach(([clientId, clientData]) => {
    const newNode = createNode({ id: clientId })
    graph.nodes.push(newNode)
  })

  buildGraphLinks(clientsDataEntries, graph)

  colorByUptime(appState, graph)

  return graph
}

function colorByUptime (appState, graph) {
  graph.nodes.forEach(node => {
    const clientData = appState.clients[node.id] || {}
    const { uptime } = clientData.debug || {}
    const color = colorForUptime(uptime, ms2Hours)
    node.color = color
  })
}

function colorForUptime (uptime, max) {
  if (!uptime) {
    return 'black'
  }
  // get color between green and red
  const youngestColor = [0,255,0]
  const oldestColor = [255,0,0]
  const percent = Math.min(uptime / max, 1)
  const color = interpolateColor(youngestColor, oldestColor, percent)
  const colorString = rgbToHex(color)
  return colorString
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
