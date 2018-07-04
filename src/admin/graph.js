const h = require('virtual-dom/h')
const s = require('virtual-dom/virtual-hyperscript/svg')

module.exports = renderGraph

function renderGraph(state) {
  const { nodes, links } = state

  return (

    s('svg', {
      width: 960,
      height: 600,
    }, [
      s('g', { class: 'links' }, links.map(renderLink)),
      s('g', { class: 'nodes' }, nodes.map(renderNode)),
    ])

  )
}

function renderNode(node) {
  return (

    s('circle', {
      r: '5',
      fill: node.color,
      cx: node.x,
      cy: node.y,
    }, [
      s('title', `${node.id}`),
    ])

  )
}

function renderLink(link) {
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
