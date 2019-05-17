const React = require('react')
const ObservableStore = require('obs-store')
const deepEqual = require('deep-equal')
const uniqBy = require('lodash.uniqby')
// using build since there were babelify dep issues
const ForceGraph2D = require('./react-force-graph-2d.min.js')

class BaseForceGraph extends React.Component {
  
  state = {
    graph: {
      nodes: [],
      links: [],
    }
  }

  buildGraph () {
    throw new Error('Must be implemented by child Class')
  }

  rebuildGraph = (state) => {
    try {
      const newGraph = this.buildGraph(state)
      const oldGraph = this.state.graph

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
      if (deepEqual(newGraph.nodes, oldGraph.nodes) &&
        deepEqual(newGraph.links, oldGraph.links)) {
        return
      }
      // update graph store
      const graph = mergeGraph(oldGraph, newGraph)
      this.setState({ graph })
    } catch (err) {
      console.error('graph rebuild err:', err)
    }
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
    // this is lame - we do it so that build works with props
    this.props = nextProps
    const { store } = this.props
    this.rebuildGraph(store.getState())
  }

  render () {
    const { actions } = this.props
    const { graph } = this.state

    return (
      <ForceGraph2D
        ref={el => { this.fg = el }}
        enableNodeDrag={false}
        // onNodeClick={this._handleClick}
        graphData={graph}
      />
    )
  }
}

module.exports = BaseForceGraph

function mergeGraph (oldGraph, newGraph) {
  const graph = {}
  // create index for faster lookups during merge
  const graphIndex = createGraphIndex(oldGraph)
  // merge old graph for existing nodes + links
  graph.nodes = newGraph.nodes.map((node) => {
    return Object.assign(graphIndex.nodes[node.id] || {}, node)
  })
  graph.links = newGraph.links.map((link) => {
    return Object.assign(graphIndex.links[link.id] || {}, link)
  })
  return graph
}

function createGraphIndex (graph) {
  const graphIndex = { nodes: {}, links: {} }
  graph.nodes.forEach(node => {
    graphIndex.nodes[node.id] = node
  })
  graph.links.forEach(link => {
    graphIndex.links[link.id] = link
  })
  return graphIndex
}