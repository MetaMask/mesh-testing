const h = require('virtual-dom/h')
const s = require('virtual-dom/virtual-hyperscript/svg')
const renderBaseGraph = require('./base')

module.exports = renderGraph

function renderGraph(state, actions) {
  return renderBaseGraph(state, actions, { renderNode, renderLink })

  function renderNode(node, state, actions) {
    const { selectedNode, networkState } = state
    const isSelected = selectedNode === node.id

    const colors = {
      GOOD: '#53FD43',
      SOSO: '#FFF971',
      BAD: '#FFB73A',
      TERRIBLE: '#FF0000',
    }

    if (!networkState.clients[node.id]
      || !(networkState.clients[node.id]
        && networkState.clients[node.id].block)) {
      return
    }

    let color = colors['TERRIBLE']
    const blockNumber = networkState.clients[node.id].block.number
      ? Number(networkState.clients[node.id].block.number)
      : 0

    if (blockNumber > 0) {
      const number = state.latestBlock - blockNumber
      if (number < 1) {
        color = colors['GOOD']
      } else if (number < 2) {
        color = colors['SOSO']
      } else if (number >= 2 && number <= 5) {
        color = colors['BAD']
      } else if (number > 5) {
        color = colors['TERRIBLE']
      }
    }

    const radius = isSelected ? 10 : 5

    const isTracking = networkState.clients[node.id].blockTrackerEnabled
    return (

      s('circle', Object.assign({
        r: radius,
        fill: color,
        cx: node.x,
        cy: node.y,
        onclick: () => actions.selectNode(node.id)
      }, isTracking ? {
        stroke: 'black',
        'stroke-width': 1,
      } : {}), [
          s('title', `${node.id}`),
        ])

    )
  }

  function renderLink(link, state, actions) {
    const { source, target } = link

    if (!state.networkState.clients[source.id]
      || !(state.networkState.clients[source.id]
        && state.networkState.clients[source.id].block)) {
      return
    }

    if (!state.networkState.clients[target.id]
      || !(state.networkState.clients[target.id]
        && state.networkState.clients[target.id].block)) {
      return
    }

    return (

      s('line', {
        strokeWidth: link.value,
        x1: source.x,
        y1: source.y,
        x2: target.x,
        y2: target.y,
      })

    )
  }

}
