// const graph = buildGraph(data)
// drawGraph(graph)

const d3 = require('d3')

module.exports = {
  setupDom,
  buildGraph,
  drawGraph,
}

function setupDom({ container, action }) {
  // svg styles
  const style = document.createElement('style')
  style.textContent = (
    `
    .links line {
      stroke: #999;
      stroke-opacity: 0.6;
    }

    .nodes circle {
      stroke: #fff;
      stroke-width: 1.5px;
    }

    button.refresh {
      width: 120px;
      height: 30px;
      background-color: #4CAF50;
      color: white;
      border-radius: 3px;
      outline: none;
      border: 0;
      cursor: pointer;
    }

    button.refresh:hover {
      background-color: green;
    }

    .legend {
      font-family: "Arial", sans-serif;
      font-size: 11px;
    }
    `
  )
  document.head.appendChild(style)

  // // svg canvas
  // const svg = document.createElement('svg')
  // container.appendChild(svg)
  // svg.setAttribute('width', 960)
  // svg.setAttribute('height', 600)

  // action button
  const button = document.createElement('button')
  button.innerText = 'Refresh Graph'
  button.setAttribute("class", "refresh")
  button.addEventListener('click', action)
  container.appendChild(button)
}

function buildGraph(data) {
  const GOOD = '#1f77b4'
  const BAD = '#aec7e8'
  const MISSING = '#ff7f0e'

  const graph = { nodes: [], links: [] }

  // first add kitsunet nodes
  Object.keys(data).forEach((clientId) => {
    const peerData = data[clientId].peers
    const badResponse = (typeof peerData !== 'object')
    graph.nodes.push({ id: clientId, color: badResponse ? BAD : GOOD })
  })

  // then links
  Object.keys(data).forEach((clientId) => {
    const peerData = data[clientId].peers
    if (typeof peerData !== 'object') return
    Object.keys(peerData).forEach((peerId) => {
      // if connected to a missing node, create missing node
      const alreadyExists = !!graph.nodes.find(item => item.id === peerId)
      if (!alreadyExists) {
        graph.nodes.push({ id: peerId, color: MISSING })
      }
      // if peer rtt is timeout, dont draw link
      const rtt = peerData[peerId]
      // if (typeof rtt === 'string') return
      const timeout = rtt === 'timeout'
      // const linkValue = Math.pow((10 - Math.log(rtt)), 2)
      const linkValue = timeout ? 0.1 : 2
      graph.links.push({ source: clientId, target: peerId, value: linkValue })
    })
  })

  return graph
}

function drawGraph(graph) {

  // var svg = d3.select("svg"),
  //     width = +svg.attr("width"),
  //     height = +svg.attr("height");


  var width = 960
  var height = 600
  var svg = d3.select("body").append("svg")
    .attr("width", width)
    .attr("height", height)

  // var color = d3.scaleOrdinal(d3.schemeCategory20);

  var simulation = d3.forceSimulation()
      .force("link", d3.forceLink().id(function(d) { return d.id; }))
      .force("charge", d3.forceManyBody())
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("x", d3.forceX(width / 2).strength(.05))
      .force("y", d3.forceY(height / 2).strength(.05))

  var link = svg.append("g")
      .attr("class", "links")
    .selectAll("line")
    .data(graph.links)
    .enter().append("line")
      .attr("stroke-width", function(d) { return Math.sqrt(d.value); });

  var node = svg.append("g")
      .attr("class", "nodes")
    .selectAll("circle")
    .data(graph.nodes)
    .enter().append("circle")
      .attr("r", 5)
      .attr("fill", function(d) { return d.color })
      .call(d3.drag()
          .on("start", dragstarted)
          .on("drag", dragged)
          .on("end", dragended));

  node.append("title")
      .text(function(d) { return d.id; });

  simulation
      .nodes(graph.nodes)
      .on("tick", ticked);

  simulation.force("link")
      .links(graph.links);

  addLegend();

  function ticked() {
    link
        .attr("x1", function(d) { return d.source.x; })
        .attr("y1", function(d) { return d.source.y; })
        .attr("x2", function(d) { return d.target.x; })
        .attr("y2", function(d) { return d.target.y; });

    node
        .attr("cx", function(d) { return d.x; })
        .attr("cy", function(d) { return d.y; });
  }

  function dragstarted(d) {
    if (!d3.event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }

  function dragged(d) {
    d.fx = d3.event.x;
    d.fy = d3.event.y;
  }

  function dragended(d) {
    if (!d3.event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }

  function addLegend() {
    var legendData = d3.scaleOrdinal()
      .domain(["GOOD - connected to Command N Control (CNC) node", "BAD - bad response", "MISSING - not connected to CNC but known to peers via libp2p"])
      .range([ '#1f77b4', '#aec7e8', '#ff7f0e' ]);

    var svg = d3.select("svg");

    var legend = svg.append("g")
      .attr("class", "legend")
      .attr("transform", "translate(20,20)")

    var legendRect = legend
      .selectAll('g')
      .data(legendData.domain());

    var legendRectE = legendRect.enter()
      .append("g")
      .attr("transform", function(d,i){
        return 'translate(0, ' + (i * 20) + ')';
      });

    legendRectE
      .append('path')
      .attr("d", d3.symbol().type(d3.symbolCircle))
      .style("fill", function (d,i) {
          return legendData(i);
      });

    legendRectE
      .append("text")
      .attr("x", 10)
      .attr("y", 5)
      .text(function (d) {
          return d;
      });

  } // end addLegend()

}
