const React = require('react')
const Tab = require('react-bootstrap/Tab')
const Tabs = require('react-bootstrap/Tabs')

class NavTabs extends React.Component {
  render() {
    const { routes } = this.props
    return (
      <Tabs
        id="navigation-tabs"
        activeKey={this.props.activeRoute}
        onSelect={this.props.onNavigate}
      >
        {routes.map(route => (
          <Tab key={route.id} eventKey={route.id} title={route.label}></Tab>
        ))}
      </Tabs>
    )
  }
}

export default NavTabs