// const React = require('react')
// const ObsStoreComponent = require('../common/obs-store')
const DebugVersions = require('./versions')
const DebugUptime = require('./uptime')

const { colorByUptime } = DebugUptime
const { colorByVersion } = DebugVersions

module.exports = initializeExperiment

function initializeExperiment ({ graphOptions, actions }) {
  // graph builder options
  Object.assign(graphOptions, {
    color: [
      ...graphOptions.color,
      { id: 'debug:uptime', label: 'uptime', value: colorByUptime },
      { id: 'debug:version', label: 'version', value: colorByVersion },
    ],
  })
}

// experiment.views.push({
//   id: 'debug:state',
//   label: 'debug',
//   render: ({ store, actions }) => (
//     <ObsStoreComponent store={store} actions={actions}/>
//   )
// })
