const React = require('react')
const h = require('react-hyperscript')
const s = require('react-hyperscript')
const renderPieChart = require('../components/pie')
const StackedArea = require('../components/stackedArea')

class SidePanel extends React.Component {
  constructor () {
    super()
    this.triggerRefresh = () => this.forceUpdate()
  }

  componentDidMount () {
    const { store } = this.props
    store.subscribe(this.triggerRefresh)
  }

  componentWillUnmount () {
    const { store } = this.props
    store.unsubscribe(this.triggerRefresh)
  }

  render () {
    const { appState, actions, store } = this.props
    // cant pass this in from parent or forceUpdate will not use latest state
    appState.networkState = store.getState() || {}
    return renderSelectedNodePanel(appState, actions)
  }
}

module.exports = SidePanel


function renderSelectedNodePanel (state, actions) {
  const { selectedNode, networkState } = state
  const clientsData = networkState.clients || {}
  const selectedNodeData = clientsData[selectedNode]
  // const selectedNodePeers = selectedNodeData.peers
  const shortId = peerIdToShortId(selectedNode)
  
  if (!selectedNode) return null

  return (

    h('div', [

      // h(
      //   'h2',
      //   `Latest block: ${
      //     selectedNodeData.block && typeof selectedNodeData.block.number !== 'undefined'
      //       ? Number(selectedNodeData.block.number)
      //       : 'N/A'
      //   }`
      // ),

      h('h2', 'selected node'),

      h('.app-selected-node', [
        `id: ${shortId}`
      ]),

      h('button', {
        onClick: () => copyToClipboard(selectedNode)
      }, 'copy id'),

      // h('button', {
      //   onClick: () => actions.pingNode(selectedNode)
      // }, 'ping'),
      // h('button', {
      //   onClick: () => actions.sendPubsub(selectedNode)
      // }, 'pubsub'),
      // h('button', {
      //   onClick: () => actions.sendMulticast(selectedNode, 1)
      // }, 'multicast 1'),
      // h('button', {
      //   onClick: () => actions.sendMulticast(selectedNode, 3)
      // }, 'multicast 3'),
      // h('button', {
      //   onClick: () => actions.sendMulticast(selectedNode, 6)
      // }, 'multicast 6'),
      // h('button', {
      //   onClick: () => actions.appendEbtMessage(selectedNode, selectedNodeData.ebtState.sequence)
      // }, 'ebt'),
      // h('button', {
      //   onClick: () => actions.restartNode(selectedNode)
      // }, 'restart'),
      // h('button', {
      //   onClick: () => {
      //     selectedNodeData.blockTrackerEnabled = !selectedNodeData.blockTrackerEnabled
      //     actions.enableBlockTracker(selectedNode, selectedNodeData.blockTrackerEnabled)
      //   }
      // }, `${selectedNodeData.blockTrackerEnabled ? 'disable' : 'enable'} block tracker`),

      h('span', `random walk: ${selectedNodeData.dht.randomWalkEnabled}`),
      
      h('button', {
        onClick: () => actions.client.sendToClient(selectedNode, 'dht.enableRandomWalk')
      }, 'random walk'),

      // selectedNodePeers && renderSelectedNodePeers(selectedNodePeers),

      renderSelectedNodeStats(selectedNode, state, actions)

    ])

  )
}

function renderSelectedNodeStats (selectedNode, state, actions) {
  const networkState = state.networkState || {}
  const clientsData = networkState.clients || {}
  const selectedNodeData = clientsData[selectedNode] || {}
  const trafficStats = selectedNodeData.traffic
  if (!trafficStats) return

  return h('div', [
    renderSelectedNodeGlobalStats(trafficStats, state, actions),
    h('div', [
      h('h4', 'peers'),
      renderSelectedNodePeerStats(trafficStats, state, actions)
    ])
  ])
}

function renderSelectedNodeGlobalStats (trafficStats, state, actions) {
  // global stats
  const timeSeries = trafficStats.timeSeries || {}
  const globalStats = timeSeries.global
  if (globalStats) {
    const transports = globalStats.transports
    const protocols = globalStats.protocols
    return (
      h('div', [
        // renderNodePeerTrafficStatsTimeSeries('transports', transports),
        renderNodePeerTrafficStatsTimeSeries('protocols', protocols),
      ])
    )
  } else {
    return (
      'no global stats'
    )
  }
}

function renderNodePeerTrafficStatsTimeSeries (label, trafficStats) {
  return ['dataSent', 'dataReceived'].map(direction => {
    return ([
      h('h3', `${label} - ${direction}`),
      h(StackedArea, {
        key: direction,
        data: trafficStats,
        direction,
      })
    ])
  })
}

function renderSelectedNodePeerStats (trafficStats, state, actions) {
  // peer stats
  const peers = Object.entries(trafficStats.peers || {})
  return peers.map(([peerId, peerData]) => {
    const transports = Object.entries(peerData.transports)
    const protocols = Object.entries(peerData.protocols)
    // const inGraph = !!state.graph.nodes.find(node => node.id === peerId)
    return h('details', { key: peerId }, [
      h('summary', [
        peerIdToShortId(peerId),
        h('button', {
          // disabled: !inGraph,
          onClick: () => actions.selectNode(peerId)
        }, 'select')
      ]),
      // renderNodePeerTrafficStats('transports', transports),
      // renderNodePeerTrafficStats('protocols', protocols)
    ])
  })
}

// function renderNodePeerTrafficStats (label, trafficCategory) {

//   return (
//     h('table', [
//       h('thead', [
//         h('tr', [
//           h('th', label),
//           h('th', '1min'),
//           h('th', 'all'),
//         ])
//       ]),
//       h('tbody', [
//         renderRow('in', trafficCategory, 'dataReceived'),
//         renderRow('out', trafficCategory, 'dataSent'),
//       ])
//     ])
//   )

//   function renderRow (label, trafficCategory, direction) {
//     const size1Min = getTimeLargest(trafficCategory, direction)
//     const label1Min = labelForFileSize(size1Min)
//     const sizeAll = getSnapshotLargest(trafficCategory, direction)
//     const labelAll = labelForFileSize(sizeAll)
//     return (
//       h('tr', [
//         h('th', label),
//         h('td', [
//           renderNodeStatsPieChart(label1Min, trafficCategory, (stats) => get1Min(stats, direction)),
//         ]),
//         h('td', [
//           renderNodeStatsPieChart(labelAll, trafficCategory, (stats) => stats.snapshot[direction])
//         ]),
//       ])
//     )
//   }
// }

// function labelForFileSize (size) {
//   const fileSizeOrder = Math.floor((Math.log(size)/Math.log(10))/3)
//   const fileSizeUnit = ['b','kb','mb'][fileSizeOrder]
//   const fileSizeForUnit = size / Math.pow(10, fileSizeOrder * 3)
//   const fileSizeLabel = `${fileSizeForUnit.toFixed(1)} ${fileSizeUnit}`
//   return fileSizeLabel
// }

// function getSnapshotLargest (trafficCategory, direction) {
//   return trafficCategory.map(([name, stats]) => stats.snapshot[direction]).filter(Boolean).sort().slice(-1)[0]
// }

// function getTimeLargest (trafficCategory, direction) {
//   return trafficCategory.map(([name, stats]) => stats.movingAverages[direction]).filter(Boolean).sort().slice(-1)[0]
// }

// function get1Min (stats, direction) {
//   return stats.movingAverages[direction]['60000']
// }

function peerIdToShortId (peerId) {
  return peerId && `${peerId.slice(0, 4)}...${peerId.slice(-4)}`
}

function copyToClipboard (str) {
  const el = document.createElement('textarea');  // Create a <textarea> element
  el.value = str;                                 // Set its value to the string that you want copied
  el.setAttribute('readonly', '');                // Make it readonly to be tamper-proof
  el.style.position = 'absolute';
  el.style.left = '-9999px';                      // Move outside the screen to make it invisible
  document.body.appendChild(el);                  // Append the <textarea> element to the HTML document
  const selected =
    document.getSelection().rangeCount > 0        // Check if there is any content selected previously
      ? document.getSelection().getRangeAt(0)     // Store selection if found
      : false;                                    // Mark as false to know no selection existed before
  el.select();                                    // Select the <textarea> content
  document.execCommand('copy');                   // Copy - only works as a result of a user action (e.g. click events)
  document.body.removeChild(el);                  // Remove the <textarea> element
  if (selected) {                                 // If a selection existed before copying
    document.getSelection().removeAllRanges();    // Unselect everything on the HTML document
    document.getSelection().addRange(selected);   // Restore the original selection
  }
}

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