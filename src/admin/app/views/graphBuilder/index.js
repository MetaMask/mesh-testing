const React = require('react')
const CustomGraph = require('./graph')
const ToggleButtonGroup = require('../../components/ToggleButtonGroup')


class GraphBuilder extends React.Component {

  constructor (...args) {
    super(...args)

    const options = this.props.graphOptions
    this.state = {
      selected: {
        topo: options.topo[0],
        color: options.color[0],
        size: options.size[0],
      }
    }
  }

  render () {
    const { store, actions, graphOptions: options } = this.props
    const { state } = this
    const { selected } = state
    const onSelect = (item, category) => {
      this.setState(state => ({ selected: { ...state.selected, [category]: item } }))
    }

    return (
      <div style={{ width: '100%', height: '100%' }}>
        {optionsSelector({ state, options, onSelect, category: 'topo' })}
        {optionsSelector({ state, options, onSelect, category: 'color' })}
        {/* {optionsSelector({ state, options, onSelect, category: 'size' })} */}
        <CustomGraph store={store} actions={actions} config={selected}/>
      </div>
    )

    function optionsSelector ({ state, options, onSelect, category }) {
      return (
        <div>
          <span>{category}:</span>
          <ToggleButtonGroup
            groupName={`GraphBuild:${category}`}
            labelKey='label'
            keyKey='id'
            options={options[category]}
            selectedOption={state.selected[category]}
            onSelect={(item) => onSelect(item, category)}
          />
        </div>
      )
    }
  }

}
 
module.exports = GraphBuilder
