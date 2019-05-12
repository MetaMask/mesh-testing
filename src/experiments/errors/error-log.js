const React = require('react')
const ObsStoreComponent = require('../common/obs-store')
const {
  interpolateColor, rgbToHex
} = require('../../util/colorUtils')

class ErrorLogComponent extends ObsStoreComponent {

  render () {
    const { store } = this.props
    const state = store.getState()
    return (
      Object.entries(state.clients).map(([clientId, clientData]) => {
        return this.renderEachClient(clientId, clientData)
      })
    )
  }

  renderEachClient (clientId, clientData) {
    const errorData = clientData.error
    if (!errorData) return
    const { errors } = errorData
    const timeOrdered = errors.slice().reverse()

    return (
      <div key={clientId}>
        <span>{clientId}</span>
        {timeOrdered.map(err => this.renderEachError(clientId, err))}
      </div>
    )
  }

  renderEachError (clientId, err) {
    const key = `${clientId}-${err.now}-${err.message}`
    return (
      <details key={key}>
        <summary>
          <span>{`${err.label} - ${err.message}`}</span>
        </summary>
        <pre>{err.stack}</pre>
      </details>
    )
  }

}

module.exports = ErrorLogComponent
module.exports.colorByErrorCount = colorByErrorCount


function colorByErrorCount (appState, graph) {
  graph.nodes.forEach(node => {
    const clientData = appState.clients[node.id]
    const { error } = clientData || {}
    const { errors } = error || {}
    const color = colorForErrorCount(errors, 5)
    node.color = color
  })
}

function colorForErrorCount (errors, max) {
  if (!errors) {
    return 'black'
  }
  const errorCount = errors.length
  // get color between green and red
  const youngestColor = [0,255,0]
  const oldestColor = [255,0,0]
  const percent = Math.min(errorCount / max, 1)
  const color = interpolateColor(youngestColor, oldestColor, percent)
  const colorString = rgbToHex(color)
  return colorString
}