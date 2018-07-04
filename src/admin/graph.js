const h = require('virtual-dom/h')
const s = require('virtual-dom/virtual-hyperscript/svg')

module.exports = renderGraph

function renderGraph(state, actions) {
  const { graph } = state
  const { nodes, links } = graph

  return (

    s('svg', {
      width: 960,
      height: 600,
    }, [
      s('g', { class: 'links' }, links.map((link) => renderLink(link, state, actions))),
      s('g', { class: 'nodes' }, nodes.map((node) => renderNode(node, state, actions))),
    ])

  )
}

function renderNode(node, state, actions) {
  const { selectedNode } = state
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
      // strokeWidth: '1.4',
      // strokeWidth: Math.sqrt(link.value),
      strokeWidth: link.value,
      x1: source.x,
      y1: source.y,
      x2: target.x,
      y2: target.y,
    })

  )
}
