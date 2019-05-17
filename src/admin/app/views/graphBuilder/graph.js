const BaseForceGraph = require('../../../../experiments/common/BaseForceGraph')

class CustomGraph extends BaseForceGraph {

  buildGraph (state) {
    const { config } = this.props
    return buildGraph(state, config)
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
