const React = require('react')
const JsonComponent = require('./json')

class ObsStoreComponent extends React.Component {

  constructor () {
    super()
    this.triggerForceUpdate = () => this.forceUpdate()
  }

  componentDidMount () {
    const { store } = this.props
    store.subscribe(this.triggerForceUpdate)
  }

  componentWillUnmount () {
    const { store } = this.props
    store.unsubscribe(this.triggerForceUpdate)
  }

  render () {
    const { store } = this.props
    return (
      <JsonComponent value={store.getState()}/>
    )
  }

}

module.exports = ObsStoreComponent
