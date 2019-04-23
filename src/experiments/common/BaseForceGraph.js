const React = require('react')
const ObservableStore = require('obs-store')
const deepEqual = require('deep-equal')
const { GraphContainer, ForceGraph } = require('react-force-directed')


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

  rebuildGraph (state) {
    const { nodes, links } = this.buildGraph(state)
    const currentGraph = this.graphStore.getState()
    // abort update if no change to graph
    if (deepEqual(nodes, currentGraph.nodes) && deepEqual(links, currentGraph.links)) return
    // update graph store
    this.graphStore.updateState({ nodes, links })
  }

  onResize (size) {
    this.graphStore.updateState({ container: size })
  }

  render () {
    const actions = {
      selectNode: console.log
    }

    return (
      <div ref={this.containerRef} style={{ width: '100%', height: '100%' }}>
        <GraphContainer onSize={size => this.onResize(size)}>
          <ForceGraph graphStore={this.graphStore} actions={actions}/>
        </GraphContainer>
        {ForceGraph.createStyle()}
      </div>
    )
  }
}

module.exports = BaseForceGraph
