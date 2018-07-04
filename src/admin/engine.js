const h = require('virtual-dom/h')
const diff = require('virtual-dom/diff')
const patch = require('virtual-dom/patch')
const createElement = require('virtual-dom/create-element')
const rafThrottle = require('raf-throttle').default

module.exports = setupDom

// minimal virtual dom rendering engine
function setupDom({ container }) {
  let tree = h('div')
  let rootNode = createElement(tree)
  container.appendChild(rootNode)

  function rerender(newTree) {
    const patches = diff(tree, newTree)
    rootNode = patch(rootNode, patches)
    tree = newTree
  }

  return rafThrottle(rerender)
}
