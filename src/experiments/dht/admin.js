const { util: { createLink } } = require('react-force-directed')
const DhtGraph = require('./graphs/routing')
const {
  topoByRoutingTable,
  colorByGroup,
} = DhtGraph
const {
  buildGraphBasicNodes,
  buildGraphAddMissingNodes,
} = require('../common/graph-viz')

module.exports = initializeExperiment

function initializeExperiment ({ graphOptions, actions, setState }) {
  // actions
  actions.dht = {
    performQueryTest: async (clientId, target, actions) => {
      // reset state
      setState(({ dht }) => ({ dht: { ...dht, queries: [] } }))
      // perform query
      const response = await actions.client.sendToClient(clientId, 'dht.findProviders', target)
      console.log('got response!', response)
      const result = response.result || {}
      const error = response.error
      // dont put in table if errored
      if (error) return console.error(error)
      // parse result
      const providers = result.result
      const query = result.query
      query.providers = providers
      query.clientId = clientId
      // add query stats to state
      if (!query) return console.warn('no query present')
      const queries = [query]
      // merge dht state
      setState(({ dht }) => ({ dht: { ...dht, queries } }))
    },
    performQueryTestOne: async (state, actions) => {
      console.log(`performing dht query test with a single subject`)
      const clientsData = state.networkState.clients
      if (!clientsData) {
        return console.warn('clients data missing') 
      }
      const clientIds = Object.keys(clientsData)
      // select test subjects
      const randomizedClients = shuffle(clientIds)
      const subject = randomizedClients[0]
      // select target
      
      const targetIndex = 1
      const targetProvider = randomizedClients[targetIndex]
      const dhtStats = clientsData[targetProvider].dht || {} 
      let target = dhtStats.group

      actions.dht.performQueryTest(subject, target, actions)
    },
    performQueryTestMany: async (maxCount, state, actions) => {
      // reset state
      // setState(({ dht }) => ({ dht: { ...dht, queries: [] } }))

      const clientsData = state.networkState.clients
      if (!clientsData) {
        return console.warn('clients data missing') 
      }
      const clientIds = Object.keys(clientsData)
      const count = Math.min(maxCount, clientIds.length)
      // select test subjects
      const randomizedClients = shuffle(clientIds)
      const subjects = randomizedClients.slice(0,count)
      // perfrom tests
      const testResults = {}
      const testTable = {}
      // performing lookups
      console.log(`performing dht query test with ${count} subjects`)
      const queries = await Promise.all(
        subjects.map(async (clientId, index) => {
          // select random target in network
          const targetIndex = (count + index) % randomizedClients.length
          const targetProvider = randomizedClients[targetIndex]
          const dhtStats = clientsData[targetProvider].dht || {} 
          let target = dhtStats.group
          // fallback to random target
          if (!target) {
            const number = 1 + Math.floor(Math.random() * 100)
            target = `group-${number}`
          }
          // query network for target
          const response = await actions.client.sendToClient(clientId, 'dht.findProviders', target)
          testResults[clientId] = response
          // record results
          const result = response.result || {}
          const error = response.error
          // dont put in table if errored
          if (error) return console.error(error)
          // const query = result.query
          const providers = result.result || []
          const routingTable = dhtStats.routingTable || []
          testTable[clientId] = {
            time: result.time,
            providers: providers.length,
            table: routingTable.length,
            target: target,
          }
          // patch query object
          const query = result.query || { paths: [] }
          query.providers = providers
          return query
        })
      )

      // const goodQueries = queries.filter(Boolean)
      // const lastGood = goodQueries.slice(-1)[0]
      // const queriesToDraw = lastGood ? [lastGood] : []
      // setState(({ dht }) => ({ dht: { ...dht, queries: queriesToDraw } }))

      const errorCount = Object.values(testResults).filter(result => result.error).length
      console.log(`dht query test results: ${count-errorCount}/${count} completed`, testResults)
      console.table(testTable)
    }
  }
  // graph builder options
  Object.assign(graphOptions, {
    topo: [
      ...graphOptions.topo,
      { id: 'dht:routingTable', label: 'dht', value: (appState, graph) => topoByRoutingTable(appState, graph, { includeMissing: false }) },
      { id: 'dht:routingTable:full', label: 'dht full', value: (appState, graph) => topoByRoutingTable(appState, graph, { includeMissing: true }) },
      { id: 'dht:query', label: 'dht query', value: topoByDhtQuery },
    ],
    color: [
      ...graphOptions.color,
      { id: 'dht:group', label: 'dht group', value: colorByGroup },
      { id: 'dht:query', label: 'dht query', value: colorByDhtQuery },
    ]
  })
}

function topoByDhtQuery (stats, graph, appState) {
  const clientsData = stats.clients
  buildGraphBasicNodes(clientsData, graph)
  buildGraphDhtQueryLinks(clientsData, graph, appState)
  return graph
}

function buildGraphDhtQueryLinks (clientsData, graph, appState) {
  const { links } = graph
  const dhtState = appState.dht || {}
  const queries = dhtState.queries || []
  queries.forEach(query => {
    const { clientId } = query
    query.paths.forEach(path => {
      // initial peers
      path.initialPeers.forEach(peerId => {
        links.push(createLink({ source: clientId, target: peerId }))
      })
      // introductions
      Object.entries(path.introductions).forEach(([peerId, intros]) => {
        intros.forEach(introId => {
          // only draw line if they introduced someone (closer or provider)
          if (!path.introductions[introId]) return
          links.push(createLink({ source: peerId, target: introId }))
        })
      })
    })
  })

  buildGraphAddMissingNodes(graph, 'red')
}

function colorByDhtQuery (stats, graph, appState) {
  const connectedIds = Object.keys(stats.clients)
  const dhtState = appState.dht || {}
  const queries = dhtState.queries || []
  // const clientsData = stats.clients
  graph.nodes.forEach((node) => {
    let color = colorForNodeByQueries(node, queries)
    if (!color) {
      if (connectedIds.includes(node.id)) {
        color = 'blue'
      } else {
        color = 'black'
      }
    }
    node.color = color
  })
}

function colorForNodeByQueries(node, queries) {
  if (queries.some(query => isNodeQueryProvider(node, query))) {
    return 'green'
  }
  if (queries.some(query => isNodeQueryOrigin(node, query))) {
    return 'pink'
  }
  if (queries.some(query => isNodeQueryInitialPeer(node, query))) {
    return 'orange'
  }
  if (queries.some(query => isNodeQueryIntroduced(node, query))) {
    return 'yellow'
  }
  return
}


function isNodeQueryProvider (node, query) {
  return query.providers.includes(node.id)
}

function isNodeQueryOrigin (node, query) {
  return query.clientId === node.id
}

function isNodeQueryInitialPeer (node, query) {
  return query.paths.some(path => path.initialPeers.includes(node.id))
}

function isNodeQueryIntroduced (node, query) {
  return query.paths.some(path => Object.values(path.introductions).flat().includes(node.id))
}

function shuffle (array) {
  var currentIndex = array.length, temporaryValue, randomIndex;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {

    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
}