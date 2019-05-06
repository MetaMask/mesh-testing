const s = require('react-hyperscript')
const d3 = require('d3')

module.exports = renderPieChart

/*
data = [{
  label: String,
  value: Number,
}]
*/

function renderPieChart({
  label,
  data,
  width,
  height,
  centerX,
  centerY,
  innerRadius,
  outerRadius,
  colors,
  renderLabels,
  onClick,
}) {
  // set defaults
  width = width || 220
  height = height || 220
  centerX = centerX || width/2
  centerY = centerY || height/2
  outerRadius = outerRadius === undefined ? Math.min(width, height)/2 : outerRadius
  innerRadius = innerRadius === undefined ? outerRadius * 0.8 : innerRadius
  colors = colors || [
    // green
    '#66c2a5',
    // blue
    '#8da0cb',
    // orange
    '#fc8d62',
    // pink
    '#e78ac3',
    // lime
    '#a6d854',
    // yellow
    '#ffd92f',
  ]
  renderLabels = renderLabels === undefined ? true : renderLabels

  // reduce pie chart radii so theres room for labels
  const textRadius = outerRadius * 0.9
  if (renderLabels) {
    innerRadius *= 0.8
    outerRadius *= 0.8
  }

  // pie chart layout util
  const pie = d3.pie()
    .value(d => d.value)
    .sort(null)

  // edge of pie
  const arc = d3.arc()
      .innerRadius(innerRadius)
      .outerRadius(outerRadius)

  // arc for text labels
  const outerArc = d3.arc()
      .innerRadius(textRadius)
      .outerRadius(textRadius)

  const sliceData = pie(data)

  return (

    s('g', {
      transform: `translate(${centerX}, ${centerY})`,
    }, [
      s('g', renderSlices()),
      renderLabels ? s('g', renderLabelLines()) : null,
      renderLabels ? s('g', renderLabelText()) : null,
      label ? renderPrimaryLabel() : null,
    ])

  )

  function renderSlices() {
    return sliceData.map((arcData, index) => {
      const fill = colors[index % colors.length]
      return s('path', {
        fill,
        d: arc(arcData),
        onClick,
      }, [
        s('title', data[index].label),
      ])
    })
  }

  function renderLabelLines() {
    return sliceData.map((arcData, index) => {
      const pos = outerArc.centroid(arcData)
      pos[0] = textRadius * (midAngle(arcData) < Math.PI ? 1 : -1)

      return s('polyline', {
        points: [arc.centroid(arcData), outerArc.centroid(arcData), pos].join(','),
        'opacity': .3,
        'stroke': 'black',
        'stroke-width': 2,
        'fill': 'none',
      })
    })
  }

  function renderLabelText() {
    return sliceData.map((arcData, index) => {
      const pos = outerArc.centroid(arcData)
      // changes the point to be on left or right depending on where label is.
      pos[0] = textRadius * (midAngle(arcData) < Math.PI ? 1 : -1)

      return s('text', {
        transform: `translate(${pos.join(',')})`,
        dy: '0.35em',
        style: {
          textAnchor: (midAngle(arcData)) < Math.PI ? 'start' : 'end',
        },
      }, data[index].label)
    })
  }

  function renderPrimaryLabel() {
    return s('text', {
      transform: `translate(0,0)`,
      dy: '0.35em',
      style: {
        textAnchor: 'middle',
      },
    }, label)
  }

  function midAngle(d) {
    return d.startAngle + (d.endAngle - d.startAngle) / 2
  }
}