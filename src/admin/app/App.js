import './bootstrap.css';
// import './App.css'

import React, { Component } from 'react'
import Nav from './components/nav'
const SidePanel = require('./views/SidePanel')
const GraphBuilder = require('./views/graphBuilder')
const dhtExperiment = require('../../experiments/dht/admin')
const errorsExperiment = require('../../experiments/errors/admin')
const debugExperiment = require('../../experiments/debug/admin')
const trafficExperiment = require('../../experiments/traffic/admin') 
const platformExperiment = require('../../experiments/platform/admin') 

class App extends Component {

  constructor() {
    super()
    this.state = {
      currentView: 'graphBuilder',
      selectedNode: null,
    }
    this.views = {}

    const graphLayout = { id: 'default:graph', label: 'graph', value: 'graph' }
    const circleLayout = { id: 'default:circle', label: 'circle', value: 'circle' }

    this.graphOptions = {
      layout: [graphLayout, circleLayout],
      topo: [],
      color: [],
      size: [],
    }

    this.views.graphBuilder = {
      id: 'graphBuilder',
      label: 'custom',
      render: ({ store, actions }) => (
        <GraphBuilder graphOptions={this.graphOptions} store={store} actions={actions} appState={this.state}/>
      )
    }

    this.actions = {
      selectNode: (clientId) => this.setState({ selectedNode: clientId }),
      client: {
        sendToClient: async (clientId, method, ...args) => {
          const { server } = this.props
          // console.log(`sendToClient "${method} - sending...`)
          const response = await server.sendToClient(clientId, method, args)
          // console.log(`sendToClient "${method}- done`, response)
          return response
        }
      }
    }

    this.loadExperiment(trafficExperiment)
    this.loadExperiment(dhtExperiment)
    this.loadExperiment(errorsExperiment)
    this.loadExperiment(debugExperiment)
    this.loadExperiment(platformExperiment)
  }

  loadExperiment (experiment) {
    const { views, graphOptions, actions } = this
    const setState = this.setState.bind(this)
    experiment({ views, graphOptions, actions, setState })
    // // gather experiment views
    // experiment.views.forEach(view => {
    //   this.views[view.id] = view
    // })
    // // gather graph builder components
    // const { graphBuilder } = experiment
    // if (graphBuilder) {
    //   this.graphOptions.layout = this.graphOptions.layout.concat(graphBuilder.layout || [])
    //   this.graphOptions.topo = this.graphOptions.topo.concat(graphBuilder.topo || [])
    //   this.graphOptions.color = this.graphOptions.color.concat(graphBuilder.color || [])
    //   this.graphOptions.size = this.graphOptions.size.concat(graphBuilder.size || [])
    // }
    // // gather experiments
    // this.experiments.push(experiment)
  }

  selectView (target) {
    this.setState(state => ({ currentView: target }))
  }

  render () {
    const { actions } = this
    // const views = Object.values(this.views)
    const currentView = this.views[this.state.currentView]
    const appState = Object.assign({}, this.state)

    return (
      <div className="App">
        <div className="AppColumn LeftPanel">
          {/* <Nav
            routes={views}
            activeRoute={this.state.currentView}
            onNavigate={(target) => this.selectView(target)}
            /> */}
            <div>
              <button onClick={() => actions.dht.performQueryTestMany(appState, actions)}>
                run dht test
              </button>
            </div>
            <div>
              {this.state.dht && 'query is ready'}
            </div>
            {currentView && currentView.render({ store: this.props.store, actions })}
        </div>
        <div className="AppColumn RightPanel">
          <SidePanel appState={appState} actions={actions} store={this.props.store}/>
        </div>
      </div>
    )
  }
}

export default App
