const { util: { createNode, createLink } } = require('react-force-directed')
const {
  buildGraphBasicNodes,
  buildGraphAddMissingNodes,
} = require('../common/graph-viz')
const BaseForceGraph = require('../common/BaseForceGraph')
const {
  interpolateColor, rgbToHex
} = require('../../util/colorUtils')

class BasicTrafficGraph extends BaseForceGraph {

  buildGraph (state) {
    return buildGraph(state)
  }

}
 
module.exports = BasicTrafficGraph
module.exports.colorByVersion = colorByVersion


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

  colorByVersion(appState, graph)

  return graph
}

function colorByVersion (appState, graph) {
  // set color based on version age
  const clientsDataEntries = Object.entries(appState.clients)
  const versions = getVersionsFromClientsDataEntries(clientsDataEntries)
  graph.nodes.forEach(node => {
    const clientId = node.id
    const clientData = appState.clients[clientId] || {}
    const debugData = clientData.debug || {}
    const version = clientData.version || debugData.version
    const color = colorForVersion(version, versions)
    node.color = color
  })
}

function getVersionsFromClientsDataEntries (clientsDataEntries) {
  const versionSet = new Set()
  clientsDataEntries.forEach(([clientId, clientData]) => {
    const debugData = clientData.debug || {}
    const version = clientData.version || debugData.version
    if (!version) return
    if (version === 'development') return
    versionSet.add(version)
  })
  const sorted = Array.from(versionSet.values()).sort().reverse()
  return sorted
}

function colorForVersion (version, versions) {
  if (!version) {
    return 'black'
  }
  if (version === 'development') {
    return 'purple'
  }
  const youngestColor = [0,255,0]
  const oldestColor = [255,0,0]
  const versionIndex = versions.indexOf(version)
  const versionsCount = versions.length
  if (versionsCount === 1) {
    return rgbToHex(youngestColor)
  }
  const percent = versionIndex/(versionsCount-1)
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
