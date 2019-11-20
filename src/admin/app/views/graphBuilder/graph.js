const d3 = require('d3')
const multihashing = require('multihashing')
const PeerId = require('peer-id')
const { posForNode, wobblePosForNode } = require('./layout-peerId')
const BaseForceGraph = require('../../../../experiments/common/BaseForceGraph')


const hashCache = new Map()

class CustomGraph extends BaseForceGraph {

  buildGraph (state) {
    const { config, appState } = this.props

    switch (config.layout.value) {
      case 'xor':
        this.setupSimulationForces = this.setupXorLayout.bind(this, { wobble: false })
        break
      case 'xor-wobble':
        this.setupSimulationForces = this.setupXorLayout.bind(this, { wobble: true })
        break
      case 'circle':
        this.setupSimulationForces = this.setupCircleLayout.bind(this)
        break
      default:
        this.setupSimulationForces = null
        break
    }

    return buildGraph(state, config, appState)
  }

  setupLayoutBasics (simulation, state) {
    const { nodes, links } = state
    const width = state.container.width || 0
    const height = state.container.height || 0
    const center = { x: width / 2, y: height / 2 }
    const radius = 0.7 * Math.min(width, height) / 2

    simulation
      .nodes(nodes)
      // pull nodes along links
      .force('link', 
        d3.forceLink()
        .id(d => d.id)
        .links(links)
        .distance(d => d.distance)
      )
      // warm then cool
      .alpha(1)
      .alphaTarget(0)
      .restart()

    return { width, height, center, radius }
  }

  setupCircleLayout (simulation, state) {
    const { nodes, links } = state    
    const { width, height, center, radius } = this.setupLayoutBasics(simulation, state)
  
    simulation.force('link')
      // dont actually run the link sim -- but use it for setting link xy pos
      .strength(0)
      .iterations(0)

    simulation
      // push nodes away from each other
      .force('charge', d3.forceManyBody().strength(d => -4 * d.radius))
      .force('collision', null)
      // // translate nodes around the center
      .force('center', d3.forceRadial(radius, center.x, center.y))
      // // push nodes towards the center
      .force('x', null)
      .force('y', null)
      // push nodes back into frame
      .force('boundry', null)
  }

  setupXorLayout (opts, simulation, state) {
    const { nodes, links } = state    
    const { width, height, center, radius } = this.setupLayoutBasics(simulation, state)

    // im sorry this is so sloppy
    function getStats () {
      return global.networkStore.getState()
    }

    function getPosForNode (node) {
      const appState = getStats() || {}
      const clientData = appState.clients
      const nodeData = clientData[node.id] || {}
      const dhtData = nodeData.dht || {}
      let { peerIdHash } = dhtData
      peerIdHash = peerIdHash || lookupPeerIdHash(node.id)
      if (!peerIdHash) return Object.assign({}, center)
      const relPos = opts.wobble ?
        wobblePosForNode(peerIdHash, radius) :
        posForNode(peerIdHash, radius)
      const { x, y } = relPos
      const pos = { x: center.x + x, y: center.y + y }
      return pos
    }

    simulation.force('link')
      // dont actually run the link sim -- but use it for setting link xy pos
      .strength(0)
      .iterations(0)

    simulation
      // push nodes away from each other
      .force('charge', null)
      .force('collision', null)
      // // translate nodes around the center
      .force('center', null)
      // // push nodes towards the center
      .force('x', d3.forceX((node) => getPosForNode(node).x))
      .force('y', d3.forceY((node) => getPosForNode(node).y))
      // push nodes back into frame
      .force('boundry', null)
  }

}
 
module.exports = CustomGraph


function buildGraph (telemetryStats, config, appState) {
  const graph = { nodes: [], links: [] }

  const clientsData = telemetryStats.clients
  if (!clientsData) return graph

  const topoFn = config.topo.value
  const colorFn = config.color.value

  topoFn(telemetryStats, graph, appState)
  colorFn(telemetryStats, graph, appState)

  return graph
}

function lookupPeerIdHash (peerIdString) {
  let hash = hashCache.get(peerIdString)
  if (hash) return hash
  const peerId = PeerId.createFromB58String(peerIdString)
  hash = multihashing.digest(peerId.id, 'sha2-256').toString('base64')
  hashCache.set(peerIdString, hash)
  return hash
}