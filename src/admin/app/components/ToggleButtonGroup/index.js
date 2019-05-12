const React = require('react')
const ToggleButtonGroup = require('react-bootstrap/ToggleButtonGroup')
const ToggleButton = require('react-bootstrap/ToggleButton')


class ToggleButtonSelector extends React.Component {
  render() {
    const { selectedOption, onSelect, options, groupName, labelKey, keyKey } = this.props

    return (
      <ToggleButtonGroup
        type="radio"
        name={groupName}
        value={selectedOption}
        onChange={onSelect}
      >
        {options.map(entry => {
          const label = entry[labelKey]
          const key = entry[keyKey]
          return (
          <ToggleButton
            key={key}
            value={entry}
            >
              {label}
            </ToggleButton>
          )
        })}
      </ToggleButtonGroup>
    )
  }
}

module.exports = ToggleButtonSelector