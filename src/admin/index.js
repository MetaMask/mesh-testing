const h = require('virtual-dom/h')
const setupDom = require('./engine')
const renderGraph = require('./graph')
const renderPieChart = require('./viz/pie')
const { setupSimulation, setupSimulationForces } = require('./simulation')

const graphWidth = 960
const graphHeight = 600

module.exports = startApp

function startApp(opts = {}) {
  const { store } = opts

  // view state
  let selectedNode = undefined
  let currentGraph = {
    nodes: [],
    links: [],
  }

  // view actions
  const actions = {
    // ui state
    selectNode: (nodeId) => {
      selectedNode = nodeId
      rerender()
    },
    // network state
    // single node
    restartNode: async (nodeId) => {
      await sendToClient(nodeId, 'refresh', [])
    },
    pingNode: async (nodeId) => {
      await sendToClient(nodeId, 'ping', [])
    },
    // broadcast
    restartAllShortDelay: () => {
      global.serverAsync.refreshShortDelay()
    },
    restartAllLongDelay: () => {
      global.serverAsync.refreshLongDelay()
    },
  }

  // setup dom + render
  const updateDom = setupDom({ container: document.body })
  rerender()

  // setup force simulation
  const simulation = setupSimulation(currentGraph)

  // setup rerender hooks
  simulation.on('tick', rerender)
  store.subscribe(rerender)
  store.subscribe((state) => {
    // merge state
    const clientData = state.clients
    const newGraph = buildGraph(clientData)
    currentGraph = mergeGraph(currentGraph, newGraph)
    // reset simulation
    setupSimulationForces(simulation, currentGraph)
    // trigger redraw
    rerender()
  })

  async function sendToClient (nodeId, method, args) {
    console.log(`START sending to "${nodeId}" "${method}" ${args}`)
    const start = Date.now()
    const result = await global.serverAsync.sendToClient(nodeId, method, args)
    const end = Date.now()
    const duration = end - start
    console.log(`END sending to "${nodeId}" "${method}" ${args} - ${result} ${duration}ms`)
  }

  function rerender() {
    const state = getState()
    updateDom(render(state, actions))
  }

  // mix in local graph over store state
  function getState() {
    const networkState = store.getState()
    return Object.assign({},
      {
        selectedNode,
        networkState,
        graph: currentGraph,
      },
    )
  }
}

function render(state, actions) {
  const { selectedNode } = state
  return (

    h('.app-container', [

      appStyle(),

      h('section.flexbox-container', [
        h('div.main', [
          renderGraph(state, actions),
        ]),

        h('div.sidebar', [

          renderGlobalPanel(state, actions),
          selectedNode && renderSelectedNodePanel(state, actions),

        ]),
      ])

    ])

  )
}

function renderGlobalPanel(state, actions) {
  const { graph } = state
  return (

    h('div', [

      h('h2', 'network'),

      h('div', [
        h('.app-info-count', `nodes: ${graph.nodes.length}`),
        h('.app-info-count', `links: ${graph.links.length}`),
      ]),

      h('button', {
        onclick: () => actions.restartAllShortDelay()
      }, 'restart all (5-10s delay)'),
      h('button', {
        onclick: () => actions.restartAllLongDelay()
      }, 'restart all (2-10m delay)'),

    ])

  )
}

function renderSelectedNodePanel(state, actions) {
  const { selectedNode, networkState } = state
  const selectedNodeData = networkState.clients[selectedNode]
  if (!selectedNodeData) return
  const selectedNodeStats = selectedNodeData.stats
  const shortId = `${selectedNode.slice(0,4)}...${selectedNode.slice(-4)}`
  return (

    h('div', [

      h('h2', 'selected node'),

      h('.app-selected-node', [
        `id: ${shortId}`,
      ]),

      h('button', {
        onclick: () => actions.restartNode(selectedNode),
      }, 'restart'),
      h('button', {
        onclick: () => actions.pingNode(selectedNode),
      }, 'ping'),

      selectedNodeStats && renderSelectedNodeStats(selectedNodeStats),

    ])

  )
}

function renderSelectedNodeStats(nodeStats) {
  return h('div', [
    renderSelectedNodeTransportTable(nodeStats),
    renderSelectedNodeTransportPieChart(nodeStats),
  ])
}

function renderSelectedNodeTransportPieChart(nodeStats) {
  const tranports = Object.entries(nodeStats.transports)
  const data = tranports.map(([transportName, stats]) => {
    return {
      label: transportName,
      value: Number.parseInt(stats.snapshot.dataSent, 10),
    }
  })

  return null
  return renderPieChart({
    data,
    // width,
    // height,
    // innerRadius,
    // outerRadius,
    // colors,
  })
}

function renderSelectedNodeTransportTable(nodeStats) {
  const tranports = Object.entries(nodeStats.transports)
  if (!tranports) return 'no transport stats yet'

  const totalRx = Number.parseInt(nodeStats.global.snapshot.dataReceived, 10)
  const totalTx = Number.parseInt(nodeStats.global.snapshot.dataSent, 10)

  // create column labels
  const columnLabels = ['transport', 'in', 'out', 'in(1m)', 'out(1m)']
  // create rows
  const rows = tranports.map(rowFromStats)
  rows.unshift(rowFromStats(['total', nodeStats.global]))

  return h('table', [
    h('thead', [
      h('tr', columnLabels.map((content) => h('th', content)))
    ]),
    h('tbody', rows),
  ])

  function rowFromStats([transportName, stats]) {
    const amountRx = Number.parseInt(stats.snapshot.dataReceived, 10)
    const amountTx = Number.parseInt(stats.snapshot.dataSent, 10)
    const percentRx = totalRx ? Math.floor(100 * amountRx / totalRx) : 100
    const percentTx = totalTx ? Math.floor(100 * amountTx / totalTx) : 100
    // if (!totalRx) console.log(totalRx, nodeStats.global.dataReceived)

    return h('tr', [
      h('td', transportName),
      h('td', `${formatBytes(amountRx)} ${percentRx}%`),
      h('td', `${formatBytes(amountTx)} ${percentTx}%`),
      h('td', formatBytes(stats.movingAverages.dataReceived['60000'])),
      h('td', formatBytes(stats.movingAverages.dataSent['60000'])),
    ])
  }

  function formatBytes(bytes) {
    let result = bytes || 0
    let unit = 'b'
    if (result > 1000000) {
      result = result / 1000000
      unit = 'mb'
    } else if (result > 1000) {
      result = result / 1000
      unit = 'kb'
    }
    result = result.toFixed(1)
    return `${result}${unit}`
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

function appStyle() {
  return h('style', [
    `
    body, html {
      margin: 0;
      padding: 0;
      height: 100%;
    }

    button {
      margin: 6px;
      padding: 4px 8px;
    }

    table {
      border-collapse: collapse;
      margin: 8px 0;
    }

    td, th {
      border: 1px solid black;
      padding: 4px;
    }

    .app-container {
      height: 100%;
    }

    .flexbox-container {
    	display: flex;
    	width: 100%;
      height: 100%;
    }

    .sidebar {
    	order: 1;
    	flex: 1;
    	background-color: #dedede;
      flex-basis: auto;
      padding: 0 12px;
      min-height: 666px;
      background: #f7f7f7;
      border-left: 1px solid;
    }

    .main {
    	order: 1;
    	flex: 5;
      padding: .5rem;
    }

    .links line {
      stroke: #999;
      stroke-opacity: 0.6;
    }

    .nodes circle {
      stroke: #fff;
      stroke-width: 1.5px;
    }

    .legend {
      font-family: "Arial", sans-serif;
      font-size: 11px;
    }
    `
  ])
}

/*
networkState shape
{
  [clientId]: {
    stats: {
      transports: {
        [transportName]: StatsObj,
      }
    },
    peers: {
      [peerId]: {
        status: 'string',
        ping: Number,
        stats: StatsObj,
      }
    }
  }
}

StatsObj shape
{
  snapshot: {
    dataReceived: String,
    dataSent: String,
  },
  movingAverages: {
    dataReceived: {
      '60000': Number,
      '300000': Number,
      '900000': Number,
    },
    dataSent: {
      '60000': Number,
      '300000': Number,
      '900000': Number,
    },
  }
}
*/

function buildGraph(networkState) {
  const GOOD = '#1f77b4'
  const BAD = '#aec7e8'
  const MISSING = '#ff7f0e'

  const graph = { nodes: [], links: [] }

  // first add kitsunet nodes
  Object.keys(networkState).forEach((clientId) => {
    const peerData = networkState[clientId].peers
    const badResponse = (typeof peerData !== 'object')
    const newNode = { id: clientId, color: badResponse ? BAD : GOOD }
    graph.nodes.push(newNode)
  })

  // then links
  Object.keys(networkState).forEach((clientId) => {
    const peerData = networkState[clientId].peers
    if (typeof peerData !== 'object') return
    Object.keys(peerData).forEach((peerId) => {
      // if connected to a missing node, create missing node
      const alreadyExists = !!graph.nodes.find(item => item.id === peerId)
      if (!alreadyExists) {
        const newNode = { id: peerId, color: MISSING }
        graph.nodes.push(newNode)
      }
      const rtt = peerData[peerId].ping
      // const didTimeout = rtt === 'timeout'
      // const linkValue = Math.pow((10 - Math.log(rtt)), 2)
      // const linkValue = didTimeout ? 0.1 : 2
      const linkValue = 2
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
