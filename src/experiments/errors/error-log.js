const React = require('react')
const ObsStoreComponent = require('../common/obs-store')
const JsonComponent = require('../common/json')

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
      <div>
        <span>{clientId}</span>
        {timeOrdered.map(err => this.renderEachError(err))}
      </div>
    )
  }

  renderEachError (err) {
    return (
      <details key={err.now} >
        <summary>
          <span>{`${err.label} - ${err.message}`}</span>
        </summary>
        <pre>{err.stack}</pre>
      </details>
    )
  }

}

module.exports = ErrorLogComponent
