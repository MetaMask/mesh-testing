const s = require('virtual-dom/virtual-hyperscript/svg')
const d3 = require('d3')

module.exports = renderPieChart

/*

data = [{
  label: String,
  value: Number,
}]

*/

function renderPieChart({
  data,
  width,
  height,
  centerX,
  centerY,
  innerRadius,
  outerRadius,
  colors,
  onclick,
}) {
  // set defaults
  width = width || 220
  height = height || 220
  centerX = centerX || width/2
  centerY = centerY || height/2
  innerRadius = innerRadius || 0
  outerRadius = outerRadius || 100
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

  const pie = d3.pie()
    .value(d => d.value)
    .sort(null)

  const arc = d3.arc()
      .innerRadius(innerRadius)
      .outerRadius(outerRadius)

  return (

    s('g', {
      transform: `translate(${centerX}, ${centerY})`,
    }, pie(data).map((arcData, index) => {
      const fill = colors[index % colors.length]
      return s('path', {
        fill,
        d: arc(arcData),
        // 'stroke': 'black',
        // 'stroke-width': '1px',
        onclick,
      })
    }))

  )
}
//
// var arc = d3.svg.arc()
// 	.outerRadius(radius * 0.8)
// 	.innerRadius(radius * 0.4);
//
// var outerArc = d3.svg.arc()
// 	.innerRadius(radius * 0.9)
// 	.outerRadius(radius * 0.9);
