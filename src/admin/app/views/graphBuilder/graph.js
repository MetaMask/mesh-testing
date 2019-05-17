const d3 = require('d3')
const { util: { createNode, createLink } } = require('react-force-directed')
const {
  buildGraphBasicNodes,
  buildGraphAddMissingNodes,
} = require('../../../../experiments/common/graph-viz')
const BaseForceGraph = require('../../../../experiments/common/BaseForceGraph')

class CustomGraph extends BaseForceGraph {

  buildGraph (state) {
    const { config } = this.props
    this.setupSimulationForces = (config.layout.value === 'circle') ? this.setupCircleLayout : null
    return buildGraph(state, config)
  }

  setupCircleLayout (simulation, state) {
    const nodes = state.nodes
    const links = state.links
    const width = state.container.width || 0
    const height = state.container.height || 0
    const center = { x: width / 2, y: height / 2 }

    const radius = 0.8 * Math.min(width, height) / 2
  
    simulation
      .nodes(nodes)
      // // pull nodes along links
      .force('link', 
        d3.forceLink()
        .id(d => d.id)
        .links(links)
        .distance(d => d.distance)
        .strength(0)
        // dont actually run this -- but use it for setting link xy pos
        .iterations(0)
      )
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
      // warm then cool
      .alpha(1)
      .alphaTarget(0)
      .restart()
  }

}
 
module.exports = CustomGraph


function buildGraph (appState, config) {
  const graph = { nodes: [], links: [] }

  const clientsData = appState.clients
  if (!clientsData) return graph

  const topoFn = config.topo.value
  const colorFn = config.color.value

  topoFn(appState, graph)
  colorFn(appState, graph)

  return graph
}
