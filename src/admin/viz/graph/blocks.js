'use strict'

const h = require('virtual-dom/h')
const s = require('virtual-dom/virtual-hyperscript/svg')
const renderBaseGraph = require('./base')

module.exports = renderGraph

function renderGraph (state, actions) {
  return renderBaseGraph(state, actions, { renderNode, renderLink })

  function renderNode (node, state, actions) {
    const { selectedNode, networkState } = state
    const isSelected = selectedNode === node.id

    const colors = {
      GOOD: '#53FD43',
      SOSO: '#FFF971',
      BAD: '#FFB73A',
      TERRIBLE: '#FF0000'
    }

    const clientState = networkState.clients[node.id]
    if (!(clientState && clientState.block)) {
      return
    }

    let color = colors['TERRIBLE']
    const blockNumber = clientState.block.number
      ? Number(clientState.block.number)
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

    const isTracking = clientState.blockTrackerEnabled
    return (

      s('circle', Object.assign({
        r: radius,
        fill: color,
        cx: node.x,
        cy: node.y,
        onclick: () => actions.selectNode(node.id)
      }, isTracking ? {
        stroke: 'black',
        'stroke-width': 2
      } : {}), [
        s('title', `${node.id}`)
      ])

    )
  }

  function renderLink (link, state, actions) {
    const { source, target } = link

    const sourceState = state.networkState.clients[source.id]
    if (!(sourceState && sourceState.block)) {
      return
    }

    const targetState = state.networkState.clients[target.id]
    if (!(targetState && targetState.block)) {
      return
    }

    return (

      s('line', {
        strokeWidth: link.value,
        x1: source.x,
        y1: source.y,
        x2: target.x,
        y2: target.y
      })

    )
  }
}
