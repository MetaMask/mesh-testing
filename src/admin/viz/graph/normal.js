const h = require('virtual-dom/h')
const s = require('virtual-dom/virtual-hyperscript/svg')
const renderBaseGraph = require('./base')

module.exports = renderGraph

function renderGraph(state, actions) {
  return renderBaseGraph(state, actions, { renderNode, renderLink })

  function renderNode(node, state, actions) {
    const { selectedNode, networkState } = state
    const isSelected = selectedNode === node.id

    return (

      s('circle', {
        r: isSelected ? 10 : 5,
        fill: node.color,
        cx: node.x,
        cy: node.y,
        onclick: () => actions.selectNode(node.id)
      }, [
        s('title', `${node.id}`),
      ])

    )
  }

  function renderLink(link, state, actions) {
    const { source, target } = link
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
