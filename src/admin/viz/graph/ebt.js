const h = require('virtual-dom/h')
const s = require('virtual-dom/virtual-hyperscript/svg')
const renderBaseGraph = require('./base')

module.exports = renderGraph

function renderGraph(messagesKey, state, actions) {
  return renderBaseGraph(state, actions, { renderNode, renderLink })

  function renderNode(node, state, actions) {
    const { selectedNode, ebtTarget, networkState } = state
    const nodeData = state.networkState.clients[node.id] || {}
    const ebtMessages = nodeData[messagesKey] || []

    const isSelected = selectedNode === node.id

    // {
    //   from,
    //   data: data.toString(),
    //   seqno: seqno.toString(),
    //   topicIDs,
    // }

    const idx = ebtMessages.length - 1 > 0 ? ebtMessages.length - 1 : 0
    const target = ebtMessages.find(m => m === ebtTarget)
    let color = target ? target : ebtMessages[idx] || '#000000'
    if (node.type !== 'good') color = '#ff7f0e'
    const radius = isSelected ? 10 : 5

    return (

      s('circle', {
        r: radius,
        fill: color,
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
