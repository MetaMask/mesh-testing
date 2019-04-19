const React = require('react')

class JsonComponent extends React.Component {

  render () {
    const jsonContent = JSON.stringify(this.props.value, null, 2)
    return (
      <pre>{jsonContent}</pre>
    )
  }

}

module.exports = JsonComponent
