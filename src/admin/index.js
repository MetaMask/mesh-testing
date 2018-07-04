const h = require('virtual-dom/h')
const setupDom = require('./engine')
const renderGraph = require('./graph')
const { setupSimulation, setupSimulationForces } = require('./simulation')

const graphWidth = 960
const graphHeight = 600

module.exports = startApp

function startApp(opts = {}) {
  const { store } = opts

  const updateDom = setupDom({ container: document.body })

  let currentGraph = {
    nodes: [],
    links: [],
  }

  const simulation = setupSimulation(currentGraph)

  // setup rerender hooks
  simulation.on('tick', rerender)
  store.subscribe(rerender)
  store.subscribe((state) => {
    console.log('store did update', state)
    // merge state
    const { clientData } = state
    const newGraph = buildGraph(clientData)
    currentGraph = mergeGraph(currentGraph, newGraph)
    // reset simulation
    setupSimulationForces(simulation, currentGraph)
    // trigger redraw
    rerender()
  })

  function rerender() {
    const state = getState()
    updateDom(render(state))
  }

  // mix in local graph over store state
  function getState() {
    return Object.assign({},
      store.getState(),
      { graph: currentGraph },
    )
  }
}

function mergeGraph(oldGraph, newGraph) {
  const graph = {}
  // create index for faster lookups during merge
  const graphIndex = createGraphIndex(oldGraph)
  // merge old graph for existing nodes + links
  graph.nodes = newGraph.nodes.map((node) => {
    return Object.assign({
      // creating all nodes at the same spot creates a big bang
      // that accidently sorts the structures out nicely
      x: graphWidth / 2,
      y: graphHeight / 2,
    }, graphIndex.nodes[node.id], node)
  })
  graph.links = newGraph.links.map((link) => {
    return Object.assign({}, graphIndex.links[link.id], link)
  })
  return graph
}

function createGraphIndex(graph) {
  const graphIndex = { nodes: {}, links: {} }
  graph.nodes.forEach(node => {
    graphIndex.nodes[node.id] = node
  })
  graph.links.forEach(link => {
    graphIndex.links[link.id] = link
  })
  return graphIndex
}

function render(state) {
  const { graph } = state
  return (

    h('.app-container', [
      appStyle(),
      h('.app-info-count', `nodes: ${graph.nodes.length}`),
      h('.app-info-count', `links: ${graph.links.length}`),
      renderGraph(graph),
    ])

  )
}

function appStyle() {
  return h('style', [
    `
    .links line {
      stroke: #999;
      stroke-opacity: 0.6;
    }

    .nodes circle {
      stroke: #fff;
      stroke-width: 1.5px;
    }

    button.refresh {
      width: 120px;
      height: 30px;
      background-color: #4CAF50;
      color: white;
      border-radius: 3px;
      outline: none;
      border: 0;
      cursor: pointer;
    }

    button.refresh:hover {
      background-color: green;
    }

    .legend {
      font-family: "Arial", sans-serif;
      font-size: 11px;
    }
    `
  ])
}

function buildGraph(data) {
  const GOOD = '#1f77b4'
  const BAD = '#aec7e8'
  const MISSING = '#ff7f0e'

  const graph = { nodes: [], links: [] }

  // first add kitsunet nodes
  Object.keys(data).forEach((clientId) => {
    const peerData = data[clientId].peers
    const badResponse = (typeof peerData !== 'object')
    const newNode = { id: clientId, color: badResponse ? BAD : GOOD }
    graph.nodes.push(newNode)
  })

  // then links
  Object.keys(data).forEach((clientId) => {
    const peerData = data[clientId].peers
    if (typeof peerData !== 'object') return
    Object.keys(peerData).forEach((peerId) => {
      // if connected to a missing node, create missing node
      const alreadyExists = !!graph.nodes.find(item => item.id === peerId)
      if (!alreadyExists) {
        const newNode = { id: peerId, color: MISSING }
        graph.nodes.push(newNode)
      }
      const rtt = peerData[peerId]
      const didTimeout = rtt === 'timeout'
      // const linkValue = Math.pow((10 - Math.log(rtt)), 2)
      const linkValue = didTimeout ? 0.1 : 2
      const linkId = `${clientId}-${peerId}`
      const newLink = { id: linkId, source: clientId, target: peerId, value: linkValue }
      graph.links.push(newLink)
    })
  })

  return graph
}
//
// function mapObject(obj, fn) {
//   const newObj = {}
//   Object.entries(obj).forEach(([key, value], index) => {
//     newObj[key] = fn(key, value, index)
//   })
//   return newObj
// }
