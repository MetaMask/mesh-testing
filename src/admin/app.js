'use strict'

const h = require('virtual-dom/h')
const s = require('virtual-dom/virtual-hyperscript/svg')
const setupDom = require('./engine')
const renderGraphNormal = require('./viz/graph/normal')
const renderGraphBlocks = require('./viz/graph/blocks')
const renderGraphPieTransportTx = require('./viz/graph/pie-transport-tx')
const renderGraphPieTransportRx = require('./viz/graph/pie-transport-rx')
const renderGraphMesh = require('./viz/graph/mesh')
const renderGraphPubsub = require('./viz/graph/pubsub')
const renderGraphEbt = require('./viz/graph/ebt')
const renderPieChart = require('./viz/pie')
const { setupSimulation, setupSimulationForces } = require('./simulation')
const copyToClipboard = require('./utils/copy-to-clipboard')

const graphWidth = 960
const graphHeight = 600

const colors = {
  blue: '#1f77b4',
  orange: '#ff7f0e',
  green: 'green'
}

module.exports = startApp

function startApp (opts = {}) {
  const { store } = opts

  // view state
  const viewModes = [
    'normal',
    'kitsunet',
    'ping',
    'pubsub',
    'multicast',
    'ebt',
    'dht',
    'pie(tx)',
    'pie(rx)',
    'mesh',
    'block'
  ]

  let viewMode = viewModes[0]
  let selectedNode
  let pubsubTarget
  let ebtTarget
  let currentGraph = {
    nodes: [],
    links: []
  }

  // for debugging
  global.setPubsubTarget = (target) => { pubsubTarget = target }

  // view actions
  const actions = {
    // ui state
    selectViewMode: (mode) => {
      viewMode = mode
      rebuildGraph()
    },
    selectNode: (nodeId) => {
      if (!currentGraph.nodes.find(node => node.id === nodeId)) return
      selectedNode = nodeId
      rebuildGraph()
    },
    // network state
    // single node
    pingNode: async (nodeId) => {
      await sendToClient(nodeId, 'ping', [])
    },
    sendPubsub: async (nodeId) => {
      pubsubTarget = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString()
      viewMode = 'pubsub'
      rerender()
      await sendToClient(nodeId, 'pubsubPublish', [pubsubTarget])
    },
    sendMulticast: async (nodeId, hops) => {
      pubsubTarget = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString()
      viewMode = 'multicast'
      rerender()
      await sendToClient(nodeId, 'multicastPublish', [pubsubTarget, hops])
    },
    restartNode: async (nodeId) => {
      await sendToClient(nodeId, 'refresh', [])
    },
    // broadcast
    restartAllShortDelay: () => {
      global.serverAsync.refreshShortDelay()
    },
    restartAllLongDelay: () => {
      global.serverAsync.refreshLongDelay()
    },
    enableBlockTracker: async (nodeId, enabled) => {
      await sendToClient(nodeId, 'enableBlockTracker', [enabled])
    },
    appendEbtMessage: async (nodeId, sequence) => {
      ebtTarget = `#${Math.floor(Math.random() * 16777215).toString(16)}`
      viewMode = 'ebt'
      rerender()
      sequence = sequence || 0
      await sendToClient(nodeId, 'ebtAppend', [{
        author: nodeId,
        sequence: ++sequence,
        content: ebtTarget
      }])
    }
  }

  // setup dom + render
  const updateDom = setupDom({ container: document.body })
  rerender()

  // setup force simulation
  const simulation = setupSimulation(currentGraph)

  // setup rerender hooks
  simulation.on('tick', rerender)
  store.subscribe(rerender)
  store.subscribe((state) => rebuildGraph())

  function rebuildGraph () {
    const appState = getState()
    const { networkState } = appState
    // merge state
    const clientData = networkState.clients
    let networkFilter
    switch (viewMode) {
      case 'kitsunet':
        networkFilter = 'kitsunet'
        break
      case 'pubsub':
        networkFilter = 'floodsub'
        break
      case 'multicast':
        networkFilter = 'multicast'
        break
      default:
        networkFilter = 'normal'
    }
    const latencyMode = (viewMode === 'ping')
    let newGraph
    if (viewMode === 'dht') {
      newGraph = buildGraphForDht(appState)
    } else {
      newGraph = buildGraphForProtocol(clientData, networkFilter, latencyMode)
    }
    currentGraph = mergeGraph(currentGraph, newGraph)
    // reset simulation
    setupSimulationForces(simulation, currentGraph)
    // trigger redraw
    rerender()
  }

  // mix in local graph over store state
  function getState () {
    const networkState = store.getState()

    let latestBlock = 0
    Object.keys(networkState.clients || {}).forEach((id) => {
      if (networkState.clients[id].block &&
        Number(networkState.clients[id].block.number) > latestBlock) {
        latestBlock = Number(networkState.clients[id].block.number)
      }
    })

    return Object.assign({},
      {
        viewModes,
        viewMode,
        selectedNode,
        pubsubTarget,
        ebtTarget,
        networkState,
        graph: currentGraph,
        latestBlock
      }
    )
  }

  async function sendToClient (nodeId, method, args) {
    console.log(`START sending to "${nodeId}" "${method}" ${args}`)
    const start = Date.now()
    const result = await global.serverAsync.sendToClient(nodeId, method, args)
    const end = Date.now()
    const duration = end - start
    console.log(`END sending to "${nodeId}" "${method}" ${args} - ${result} ${duration}ms`)
  }

  function rerender () {
    global.requestAnimationFrame(() => {
      const state = getState()
      updateDom(render(state, actions))
    })
  }
}

function render (state, actions) {
  const { selectedNode } = state
  return (

    h('.app-container', [

      appStyle(),

      h('section.flexbox-container', [
        h('div.main', [
          renderViewModeButons(state, actions),
          renderNodeSelect(state, actions),
          renderGraph(state, actions)
        ]),

        h('div.sidebar', [

          renderGlobalPanel(state, actions),
          selectedNode && renderSelectedNodePanel(state, actions)

        ])
      ])

    ])

  )
}

function renderViewModeButons (state, actions) {
  return h('div', state.viewModes.map((mode) => h('button', {
    onclick: () => actions.selectViewMode(mode)
  }, mode)))
}

function renderNodeSelect (state, actions) {
  return h('input', {
    placeholder: 'nodeId to select',
    oninput: (event) => actions.selectNode(event.target.value)
  })
}

function renderGraph (state, actions) {
  const { viewMode } = state
  switch (viewMode) {
    case 'pie(tx)': return renderGraphPieTransportTx(state, actions)
    case 'pie(rx)': return renderGraphPieTransportRx(state, actions)
    case 'mesh': return renderGraphMesh(state, actions)
    case 'pubsub': return renderGraphPubsub('pubsub', state, actions)
    case 'multicast': return renderGraphPubsub('multicast', state, actions)
    case 'ebt': return renderGraphEbt('ebt', state, actions)
    case 'block': return renderGraphBlocks(state, actions)
    default: return renderGraphNormal(state, actions)
  }
}

function renderGlobalPanel (state, actions) {
  const { graph } = state
  return (

    h('div', [

      h('h2', 'network'),

      h('div', [
        h('.app-info-count', `nodes: ${graph.nodes.length}`),
        h('.app-info-count', `links: ${graph.links.length}`)
      ]),

      h('button', {
        onclick: () => actions.restartAllShortDelay()
      }, 'restart all (5-10s delay)'),
      h('button', {
        onclick: () => actions.restartAllLongDelay()
      }, 'restart all (2-10m delay)')

    ])

  )
}

function renderSelectedNodePanel (state, actions) {
  const { selectedNode, networkState } = state
  const selectedNodeData = networkState.clients[selectedNode] || { ebtState: {} }
  const selectedNodePeers = selectedNodeData.peers
  const shortId = peerIdToShortId(selectedNode)
  return (

    h('div', [

      h(
        'h2',
        `Latest block: ${
          selectedNodeData.block && typeof selectedNodeData.block.number !== 'undefined'
            ? Number(selectedNodeData.block.number)
            : 'N/A'
        }`
      ),

      h('h2', 'selected node'),

      h('.app-selected-node', [
        `id: ${shortId}`
      ]),

      h('button', {
        onclick: () => copyToClipboard(selectedNode)
      }, 'copy id'),

      h('button', {
        onclick: () => actions.pingNode(selectedNode)
      }, 'ping'),
      h('button', {
        onclick: () => actions.sendPubsub(selectedNode)
      }, 'pubsub'),
      h('button', {
        onclick: () => actions.sendMulticast(selectedNode, 1)
      }, 'multicast 1'),
      h('button', {
        onclick: () => actions.sendMulticast(selectedNode, 3)
      }, 'multicast 3'),
      h('button', {
        onclick: () => actions.sendMulticast(selectedNode, 6)
      }, 'multicast 6'),
      h('button', {
        onclick: () => actions.appendEbtMessage(selectedNode, selectedNodeData.ebtState.sequence)
      }, 'ebt'),
      h('button', {
        onclick: () => actions.restartNode(selectedNode)
      }, 'restart'),
      h('button', {
        onclick: () => {
          selectedNodeData.blockTrackerEnabled = !selectedNodeData.blockTrackerEnabled
          actions.enableBlockTracker(selectedNode, selectedNodeData.blockTrackerEnabled)
        }
      }, `${selectedNodeData.blockTrackerEnabled ? 'disable' : 'enable'} block tracker`),

      // selectedNodePeers && renderSelectedNodePeers(selectedNodePeers),

      renderSelectedNodeStats(selectedNode, state, actions)

    ])

  )
}

// function renderSelectedNodePeers(nodePeers) {
//   const peers = Object.entries(nodePeers).sort(([peerA], [peerB]) => peerA > peerB)
//   return h('div', [
//     renderNodePeersTable(peers),
//     h('div', [
//       renderNodeStatsPieChart('in 1min', peers, (peerData) => peerData.stats.movingAverages.dataReceived['60000']),
//       renderNodeStatsPieChart('in all', peers, (peerData) => peerData.stats.snapshot.dataReceived),
//     ]),
//     h('div', [
//       renderNodeStatsPieChart('out 1min', peers, (peerData) => peerData.stats.movingAverages.dataSent['60000']),
//       renderNodeStatsPieChart('out all', peers, (peerData) => peerData.stats.snapshot.dataSent),
//     ]),
//   ])
// }
//
// function renderNodePeersTable(peers) {
//
//   // create column labels
//   const columnLabels = ['peers', 'ping', 'in(1m)', 'out(1m)', 'in', 'out']
//   // create rows
//   const rows = peers.map(rowFromStats)
//
//   return renderTable({ columnLabels, rows })
//
//   function rowFromStats([peerId, peerData]) {
//     const { stats } = peerData
//     const amountRx = Number.parseInt(stats.snapshot.dataReceived, 10)
//     const amountTx = Number.parseInt(stats.snapshot.dataSent, 10)
//     const shortId = peerIdToShortId(peerId)
//
//     return [
//       shortId,
//       String(peerData.ping),
//       `${formatBytes(amountRx)}`,
//       `${formatBytes(amountTx)}`,
//       formatBytes(stats.movingAverages.dataReceived['60000']),
//       formatBytes(stats.movingAverages.dataSent['60000']),
//     ]
//   }
// }

function renderSelectedNodeStats (selectedNode, state, actions) {
  const networkState = state.networkState || {}
  const clientsData = networkState.clients || {}
  const selectedNodeData = clientsData[selectedNode] || {}
  const trafficStats = (selectedNodeData.libp2p || {}).traffic
  if (!trafficStats) return

  return h('div', [
    renderSelectedNodeGlobalStats(trafficStats, state, actions),
    h('div', [
      h('h4', 'peers'),
      renderSelectedNodePeerStats(trafficStats, state, actions)
    ])
    // renderSelectedNodeTransportStats(nodeStats),
    // renderSelectedNodeProtocolStats(nodeStats),
  ])
}

function renderSelectedNodeGlobalStats (trafficStats, state, actions) {
  // global stats
  if (trafficStats.global) {
    const transports = Object.entries(trafficStats.global.transports)
    const protocols = Object.entries(trafficStats.global.protocols)
    return (
      h('div', [
        renderNodePeerTransportStats(transports),
        renderNodePeerProtocolStats(protocols)
      ])
    )
  } else {
    return (
      'no global stats'
    )
  }
}

function renderSelectedNodePeerStats (trafficStats, state, actions) {
  // peer stats
  const peers = Object.entries(trafficStats.peers || {})
  return peers.map(([peerId, peerData]) => {
    const transports = Object.entries(peerData.transports)
    const protocols = Object.entries(peerData.protocols)
    const inGraph = !!state.graph.nodes.find(node => node.id === peerId)
    return h('details', [
      h('summary', [
        peerIdToShortId(peerId),
        h('button', {
          disabled: !inGraph,
          onclick: () => actions.selectNode(peerId)
        }, 'select')
      ]),
      renderNodePeerTransportStats(transports),
      renderNodePeerProtocolStats(protocols)
    ])
  })
}

function renderNodePeerTransportStats (transports) {
  return h('div', [
    h('h5', 'transports'),
    h('div', [
      renderNodeStatsPieChart('in 1min', transports, (stats) => get1Min(stats, 'dataReceived')),
      renderNodeStatsPieChart('in all', transports, (stats) => stats.snapshot.dataReceived)
    ]),
    h('div', [
      renderNodeStatsPieChart('out 1min', transports, (stats) => get1Min(stats, 'dataSent')),
      renderNodeStatsPieChart('out all', transports, (stats) => stats.snapshot.dataSent)
    ])
  ])
}

function renderNodePeerProtocolStats (protocols) {
  return h('div', [
    h('h5', 'protocols'),
    h('div', [
      renderNodeStatsPieChart('in 1min', protocols, (stats) => get1Min(stats, 'dataReceived')),
      renderNodeStatsPieChart('in all', protocols, (stats) => stats.snapshot.dataReceived)
    ]),
    h('div', [
      renderNodeStatsPieChart('out 1min', protocols, (stats) => get1Min(stats, 'dataSent')),
      renderNodeStatsPieChart('out all', protocols, (stats) => stats.snapshot.dataSent)
    ])
  ])
}

function get1Min (stats, direction) {
  return stats.movingAverages[direction]['60000']
}

// function renderSelectedNodeProtocolStats(nodeStats) {
//   const protocols = Object.entries(nodeStats.protocols)
//   if (!protocols) return 'no protocol stats yet'
//   return renderNodeStats('protocol', protocols, nodeStats)
// }
//
// function renderSelectedNodeTransportStats(nodeStats) {
//   const transports = Object.entries(nodeStats.transports)
//   if (!transports) return 'no transport stats yet'
//   return renderNodeStats('transport', transports, nodeStats)
// }
//
// function renderNodeStats(primaryLabel, specificStats, nodeStats) {
//   return (
//     h('div', [
//       renderNodeStatsTable(primaryLabel, specificStats, nodeStats),
//       h('div', [
//         h('h4', 'in'),
//         renderNodeStatsPieChart('1min', specificStats, (stats) => stats.movingAverages.dataReceived['60000']),
//         renderNodeStatsPieChart('all', specificStats, (stats) => Number.parseInt(stats.snapshot.dataReceived, 10)),
//       ]),
//       h('div', [
//         h('h4', 'out'),
//         renderNodeStatsPieChart('1min', specificStats, (stats) => stats.movingAverages.dataSent['60000']),
//         renderNodeStatsPieChart('all', specificStats, (stats) => Number.parseInt(stats.snapshot.dataSent, 10)),
//       ]),
//     ])
//   )
// }

function renderNodeStatsPieChart (label, specificStats, mapFn) {
  const data = specificStats.map(([name, stats]) => {
    return {
      label: name,
      value: mapFn(stats)
    }
  })

  const width = 80
  const height = 80

  return (

    s('svg', { width, height }, [
      renderPieChart({ data, width, height, label, renderLabels: false })
    ])

  )
}

function renderNodeStatsTable (primaryLabel, tableStats, nodeStats) {
  const totalRx = Number.parseInt(nodeStats.global.snapshot.dataReceived, 10)
  const totalTx = Number.parseInt(nodeStats.global.snapshot.dataSent, 10)

  // create column labels
  const columnLabels = [primaryLabel, 'in', 'out', 'in(1m)', 'out(1m)']
  // create rows
  const rows = tableStats.map(rowFromStats)
  rows.unshift(rowFromStats(['total', nodeStats.global]))

  return renderTable({ columnLabels, rows })

  function rowFromStats ([transportName, stats]) {
    const amountRx = Number.parseInt(stats.snapshot.dataReceived, 10)
    const amountTx = Number.parseInt(stats.snapshot.dataSent, 10)
    const percentRx = totalRx ? Math.floor(100 * amountRx / totalRx) : 100
    const percentTx = totalTx ? Math.floor(100 * amountTx / totalTx) : 100

    return [
      transportName,
      `${formatBytes(amountRx)} ${percentRx}%`,
      `${formatBytes(amountTx)} ${percentTx}%`,
      formatBytes(stats.movingAverages.dataReceived['60000']),
      formatBytes(stats.movingAverages.dataSent['60000'])
    ]
  }
}

function renderTable ({ columnLabels, rows }) {
  return (

    h('table', [
      h('thead', [
        h('tr', columnLabels.map((content) => h('th', content)))
      ]),
      h('tbody', rows.map((rowContent) => {
        return h('tr', rowContent.map(content => h('td', content)))
      }))
    ])

  )
}

function mergeGraph (oldGraph, newGraph) {
  const graph = {}
  // create index for faster lookups during merge
  const graphIndex = createGraphIndex(oldGraph)
  // merge old graph for existing nodes + links
  graph.nodes = newGraph.nodes.map((node) => {
    return Object.assign({
      // creating all nodes at the same spot creates a big bang
      // that accidently sorts the structures out nicely
      x: graphWidth / 2,
      y: graphHeight / 2
    }, graphIndex.nodes[node.id], node)
  })
  graph.links = newGraph.links.map((link) => {
    return Object.assign({}, graphIndex.links[link.id], link)
  })
  return graph
}

function createGraphIndex (graph) {
  const graphIndex = { nodes: {}, links: {} }
  graph.nodes.forEach(node => {
    graphIndex.nodes[node.id] = node
  })
  graph.links.forEach(link => {
    graphIndex.links[link.id] = link
  })
  return graphIndex
}

function appStyle () {
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
      overflow: scroll;
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

    // .nodes circle {
    //   stroke: #fff;
    //   stroke-width: 1.5px;
    // }

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

function buildGraphForDht (appState) {
  const graph = { nodes: [], links: [] }

  const { networkState, selectedNode } = appState
  const clientsData = networkState.clients
  if (!clientsData) return graph

  buildGraphBasicNodes(clientsData, graph)
  buildGraphDhtLinks(clientsData, graph)

  // recolor nodes in dht experiment "hello"
  // color green if they were part of the getMany response
  recolorNodesForDhtHello(appState, graph)

  return graph
}

function recolorNodesForDhtHello (appState, graph) {
  const { networkState, selectedNode } = appState
  const clientsData = networkState.clients
  // if no selectedNode, we're done
  if (!selectedNode) return
  const selectedNodeState = clientsData[selectedNode]

  // abort if data is missing
  if (!selectedNodeState) return
  if (!selectedNodeState.dht) return

  // color matching nodes
  const dhtQueriedNodes = selectedNodeState.dht.hello.map(entry => entry.from)
  graph.nodes.forEach((node) => {
    if (dhtQueriedNodes.includes(node.id)) {
      node.color = colors.green
    }
  })
}

function buildGraphForProtocol (networkState, networkFilter, latencyMode) {
  const graph = { nodes: [], links: [] }

  buildGraphBasicNodes(networkState, graph)
  buildGraphStatsLinks(networkState, graph, networkFilter, latencyMode)

  return graph
}

function buildGraphBasicNodes (networkState, graph) {
  // first add kitsunet nodes
  Object.keys(networkState).forEach((clientId) => {
    // const peerData = networkState[clientId].peers
    // const badResponse = (typeof peerData !== 'object')
    const newNode = { id: clientId, color: colors.blue }
    graph.nodes.push(newNode)
  })
}

function buildGraphDhtLinks (networkState, graph) {
  // build links from stats
  Object.entries(networkState).forEach(([clientId, clientData]) => {
    const libp2pData = clientData.libp2p || {}
    const dhtData = libp2pData.dht || {}
    const peers = dhtData.routingTable
    if (!peers) return

    const links = peers.map(({ id: peerId }) => {
      const source = clientId
      const target = peerId
      return {
        id: `${source}-${target}`,
        source,
        target,
        distance: 30,
        value: 2
      }
    })

    graph.links = graph.links.concat(links)
  })

  buildGraphAddMissingNodes(networkState, graph)
}

function buildGraphStatsLinks (networkState, graph, networkFilter, latencyMode) {
  // build links from stats
  Object.entries(networkState).forEach(([clientId, clientData]) => {
    const libp2pStats = clientData.libp2p || {}
    const clientTrafficStats = libp2pStats.traffic || {}
    const peers = clientTrafficStats.peers
    if (!peers) return

    let links = Object.entries(peers).map(([peerId, peerStats]) => {
      const source = clientId
      const target = peerId
      const kitsunetPeerData = clientData.kitsunet.peers[peerId]
      const ping = kitsunetPeerData ? kitsunetPeerData.ping : null
      const pingDistance = 60 * Math.log(ping || 1000)
      const distance = latencyMode ? pingDistance : 30
      return {
        id: `${source}-${target}`,
        source,
        target,
        distance,
        value: 2
      }
    })
    // filter by protocol name
    if (networkFilter) {
      links = links.filter(({ target }) => {
        const peerStats = peers[target]
        const protocolNames = Object.keys(peerStats.protocols)
        return protocolNames.some(name => name.includes(networkFilter))
      })
    }

    graph.links = graph.links.concat(links)
  })

  buildGraphAddMissingNodes(networkState, graph)
}

function buildGraphAddMissingNodes (networkState, graph) {
  graph.links.forEach((link) => {
    const { target } = link
    // if connected to a missing node, create missing node
    const alreadyExists = !!graph.nodes.find(item => item.id === target)
    if (!alreadyExists) {
      const newNode = { id: target, color: colors.orange }
      graph.nodes.push(newNode)
    }
  })
}

function formatBytes (bytes) {
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

function peerIdToShortId (peerId) {
  return peerId && `${peerId.slice(0, 4)}...${peerId.slice(-4)}`
}
