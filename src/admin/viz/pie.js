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
}) {
  // set defaults
  width = width || 220
  height = height || 220
  centerX = centerX || width/2
  centerY = centerY || height/2
  innerRadius = innerRadius || 0
  outerRadius = outerRadius || 100
  colors = colors || ['#66c2a5','#fc8d62','#8da0cb','#e78ac3','#a6d854','#ffd92f']

  const pie = d3.pie()
    .value(d => d.value)
    .sort(null)

  const arc = d3.arc()
      .innerRadius(innerRadius)
      .outerRadius(outerRadius)

  return (

    // s('svg', {
    //   width,
    //   height,
    // }, [
      s('g', {
        transform: `translate(${centerX}, ${centerY})`,
      }, pie(data).map((arcData, index) => {
        const fill = colors[index % colors.length]
        return s('path', {
          fill,
          d: arc(arcData),
          // 'stroke': 'black',
          // 'stroke-width': '1px',
        })
      }))
    // ])

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