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
