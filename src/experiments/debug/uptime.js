const { util: { createNode, createLink } } = require('react-force-directed')
const {
  buildGraphBasicNodes,
  buildGraphAddMissingNodes,
} = require('../common/graph-viz')
const BaseForceGraph = require('../common/BaseForceGraph')
const ms2Hours = 2 * 60 * 60 * 1000

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

  // create nodes and set color based on version age
  clientsDataEntries.forEach(([clientId, clientData]) => {
    const { uptime } = clientData.debug || {}
    const color = colorForUptime(uptime, ms2Hours)
    const newNode = createNode({ id: clientId, color })
    graph.nodes.push(newNode)
  })

  buildGraphLinks(clientsDataEntries, graph)

  return graph
}

function colorForUptime (uptime, max) {
  if (!uptime) {
    return 'purple'
  }
  // green
  const youngestColor = [0,255,0]
  // red
  const oldestColor = [255,0,0]
  const percent = Math.min(uptime / max, 1)
  const color = interpolateColor(youngestColor, oldestColor, percent)
  const colorString = rgbToHex(color)
  return colorString
}

function interpolateColor(color1, color2, factor) {
  const result = color1.map((part, index) => {
    const color1Part = color1[index]
    const color2Part = color2[index]
    const diff = factor * (color2Part - color1Part)
    return Math.round(color1Part + diff)
  })
  return result
}

function componentToHex(c) {
  var hex = c.toString(16);
  return hex.length == 1 ? "0" + hex : hex;
}

function rgbToHex([r, g, b]) {
  return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
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
