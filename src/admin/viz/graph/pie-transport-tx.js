'use strict'

const renderPieBaseGraph = require('./pie')

module.exports = renderGraph

function renderGraph (state, actions) {
  return renderPieBaseGraph(state, actions, { nodeToPieData })

  function nodeToPieData (node, state) {
    const { networkState } = state
    const nodeData = networkState.clients[node.id]
    const nodeStats = nodeData && nodeData.stats
    if (!nodeStats || !nodeStats.global) return
    const transports = Object.entries(nodeStats.global.transports || {})
    if (!transports.length) return
    const data = transports.map(([transportName, stats]) => {
      return {
        label: transportName,
        value: Number.parseInt(stats.snapshot.dataSent, 10)
      }
    })
    return data
  }
}
