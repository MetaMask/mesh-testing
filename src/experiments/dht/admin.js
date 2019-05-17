const DhtGraph = require('./graphs/routing')
const {
  topoByRoutingTable,
  colorByGroup,
} = DhtGraph

module.exports = initializeExperiment

function initializeExperiment ({ graphOptions, actions }) {
  // actions
  actions.dht = {
    performQueryTest: async (state, actions) => {
      const clientsData = state.networkState.clients
      if (!clientsData) {
        return console.warn('clients data missing') 
      }
      const clientIds = Object.keys(clientsData)
      const count = Math.min(10, clientIds.length)
      // select test subjects
      const randomizedClients = shuffle(clientIds)
      const subjects = randomizedClients.slice(0,count)
      // perfrom tests
      const testResults = {}
      const testTable = {}
      // performing lookups
      console.log(`performing dht query test with ${count} subjects`)
      await Promise.all(
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
          // record results
          const result = response.result || {}
          const providers = result.result || []
          const error = response.error || {}
          testResults[clientId] = response
          testTable[clientId] = {
            time: result.time,
            providers: providers.length,
            target: target,
            error: error.message,
          }
        })
      )
      console.log('dht query test results', testResults)
      console.table(testTable)
    }
  }
  // graph builder options
  Object.assign(graphOptions, {
    topo: [
      ...graphOptions.topo,
      { id: 'dht:routingTable', label: 'dht', value: (appState, graph) => topoByRoutingTable(appState, graph, { includeMissing: false }) },
      { id: 'dht:routingTable:full', label: 'dht full', value: (appState, graph) => topoByRoutingTable(appState, graph, { includeMissing: true }) },
    ],
    color: [
      ...graphOptions.color,
      { id: 'dht:group', label: 'dht group', value: colorByGroup },
    ]
  })
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