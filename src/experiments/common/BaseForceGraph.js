const React = require('react')
const ObservableStore = require('obs-store')
const deepEqual = require('deep-equal')
const { GraphContainer, ForceGraph } = require('react-force-directed')
const uniqBy = require('lodash.uniqby')

class BaseForceGraph extends React.Component {

  constructor () {
    super()
    // prepare empty graph
    const graph = { nodes: [], links: [], container: { width: 0, height: 0 } }
    // contain graph in observable store
    this.graphStore = new ObservableStore(graph)
    // bind for listener
    this.rebuildGraph = this.rebuildGraph.bind(this)
  }

  buildGraph () {
    throw new Error('Must be implemented by child Class')
  }

  componentDidMount () {
    const { store } = this.props
    store.subscribe(this.rebuildGraph)
    this.rebuildGraph(store.getState())
  }

  componentWillUnmount () {
    const { store } = this.props
    store.unsubscribe(this.rebuildGraph)
  }

  // force graph rebuild on proprs update
  componentWillReceiveProps (nextProps) {
    this.props = nextProps
    const { store } = this.props
    this.rebuildGraph(store.getState())
  }

  rebuildGraph (state) {
    const newGraph = this.buildGraph(state)
    const currentGraph = this.graphStore.getState()

    // ensure links have an id
    newGraph.links.forEach(link => {
      const { source, target } = link
      const direction = source > target
      const [start, end] = direction ? [source, target] : [target, source]
      const linkId = `${start}-${end}`
      link.id = linkId
    })

     // dedupe links (~42% savings on links)
    newGraph.links = uniqBy(newGraph.links, 'id')

    // abort update if no change to graph
    if (deepEqual(newGraph.nodes, currentGraph.nodes)
      && deepEqual(newGraph.links, currentGraph.links)) {
      return
    }
    // update graph store
    this.graphStore.updateState(newGraph)
  }

  onResize (size) {
    this.graphStore.updateState({ container: size })
  }

  render () {
    const { actions } = this.props
    const setupSimulationForces = this.setupSimulationForces

    return (
      <div ref={this.containerRef} style={{ width: '100%', height: '100%' }}>
        <GraphContainer onSize={size => this.onResize(size)}>
          <ForceGraph
            graphStore={this.graphStore}
            actions={actions}
            setupSimulationForces={setupSimulationForces}
          />
        </GraphContainer>
        {ForceGraph.createStyle()}
      </div>
    )
  }
}

module.exports = BaseForceGraph