import './bootstrap.css';
// import './App.css'

import React, { Component } from 'react'
import Nav from './components/nav'
const dhtExperiment = require('../../experiments/dht/admin')
const errorsExperiment = require('../../experiments/errors/admin')

class App extends Component {

  constructor() {
    super()
    this.state = {
      currentView: 'dht'
    }
    this.views = {}

    this.loadExperiment(dhtExperiment)
    this.loadExperiment(errorsExperiment)
  }

  loadExperiment (experiment) {
    // load experiment views
    experiment.views.forEach(view => {
      this.views[view.id] = view
    })
  }

  selectView (target) {
    this.setState(state => ({ currentView: target }))
  }

  render () {
    const views = Object.values(this.views)
    const currentView = this.views[this.state.currentView]

    return (
      <div className="App">
        <Nav
          routes={views}
          activeRoute={this.state.currentView}
          onNavigate={(target) => this.selectView(target)}
          />
          {currentView && currentView.render({ store: this.props.store })}
      </div>
    )
  }
}

export default App
