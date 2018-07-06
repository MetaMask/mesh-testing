const h = require('virtual-dom/h')
const s = require('virtual-dom/virtual-hyperscript/svg')
const renderBaseGraph = require('./base')

module.exports = renderGraph

function renderGraph(state, actions) {
  return renderBaseGraph(state, actions, { renderNode, renderLink })

  function renderNode(node, state, actions) {
    return null
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
