import React, { PureComponent } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';


module.exports = class StackedArea extends PureComponent {
  render() {
    const { data, direction } = this.props
    const dataEntries = Object.entries(data)
    // transform the data from rows into columns
    const timeSeriesLength = 10
    // create rows with label
    const rows = Array(timeSeriesLength).fill().map((_, index) => {
      return { label: `${index*10}s ago` }
    })
    // populate rows column by column
    dataEntries.forEach(([protocolName, protocolStats]) => {
      const timeSeries = protocolStats[direction]
      Array(timeSeriesLength).fill().forEach((_, index) => {
        rows[index][protocolName] = timeSeries[index] || 0
      })
    })

    const bitrateToLabel = (size) => `${labelForFileSize(size)}/s`

    return (
      <AreaChart
        width={400}
        height={200}
        data={rows}
        margin={{
          top: 30, right: 30, left: 0, bottom: 0,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="label" />
        <YAxis tickFormatter={bitrateToLabel}/>
        <Tooltip formatter={bitrateToLabel}/>
        {this.renderAreas(dataEntries)}
      </AreaChart>
    )
  }

  renderAreas (columns) {
    return columns.map(([colName], index) => {
      const colors = [ '#8884d8', '#82ca9d', '#ffc658' ] 
      const color = colors[index % colors.length]
      return (
        <Area
          type="monotone"
          key={colName}
          dataKey={colName}
          stackId="1"
          stroke={color}
          fill={color}
          />
      )
    })
  }
}

function labelForFileSize (size) {
  const fileSizeOrder = (size === 0) ? 0 : Math.floor((Math.log(size)/Math.log(10))/3)
  const fileSizeUnit = ['b','kb','mb'][fileSizeOrder]
  const fileSizeForUnit = size / Math.pow(10, fileSizeOrder * 3)
  const fileSizeLabel = `${fileSizeForUnit.toFixed(1)} ${fileSizeUnit}`
  return fileSizeLabel
}
