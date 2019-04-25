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

    return (
      <AreaChart
        width={400}
        height={200}
        data={rows}
        margin={{
          top: 10, right: 30, left: 0, bottom: 0,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="label" />
        <YAxis />
        <Tooltip />
        {this.renderAreas(dataEntries)}
      </AreaChart>
    );
  }

  renderAreas (columns) {
    return columns.map(([colName], index) => {
      const colors = [ '#8884d8', '#82ca9d', '#ffc658' ] 
      const color = colors[index % colors.length]
      return (
        <Area type="monotone" dataKey={colName} stackId="1" stroke={color} fill={color} />
      )
    })
  }
}



// // set the dimensions and margins of the graph
// var margin = {top: 10, right: 30, bottom: 30, left: 60},
//     width = 460 - margin.left - margin.right,
//     height = 400 - margin.top - margin.bottom;

// // append the svg object to the body of the page
// var svg = d3.select("#my_dataviz")
//   .append("svg")
//     .attr("width", width + margin.left + margin.right)
//     .attr("height", height + margin.top + margin.bottom)
//   .append("g")
//     .attr("transform",
//           "translate(" + margin.left + "," + margin.top + ")");

//     const data = [
//         ['1880','F','Helen',636,0.00651612638826278]
//         ['1880','F','Amanda',241,0.00246916109995492]
//         ['1880','F','Betty',117,0.00119872136387853]
//         ['1880','F','Dorothy',112,0.00114749395516577]
//         ['1880','F','Linda',27,0.000276628007048891]
//         ['1880','F','Deborah',12,0.000122945780910618]
//         ['1880','F','Jessica',7,7.17183721978607e-05]
//         ['1881','F','Helen',612,0.00619088564058469]
//         ['1881','F','Amanda',263,0.0026604622932578]
//         ['1881','F','Betty',112,0.00113297253553184]
//         ['1881','F','Dorothy',109,0.00110262505690152]
//         ['1881','F','Linda',38,0.000384401395984017]
//         ['1881','F','Deborah',14,0.00014162156694148]
//         ['1881','F','Jessica',7,7.081078347074e-05]
//         ['1882','F','Helen',838,0.00724311990042871]
//         ['1882','F','Amanda',288,0.00248928225694925]
//         ['1882','F','Betty',123,0.00106313096390541]
//         ['1882','F','Dorothy',115,0.000993984234545706]
//         ['1882','F','Linda',36,0.000311160282118656]
//         ['1882','F','Deborah',15,0.00012965011754944]
//         ['1882','F','Jessica',8,6.91467293597013e-05]
//         ['1883','F','Helen',862,0.0071798032633955]
//         ['1883','F','Amanda',287,0.00239049134175697]
//         ['1883','F','Dorothy',141,0.00117442257556701]
//         ['1883','F','Betty',120,0.000999508574950649]
//         ['1883','F','Linda',49,0.000408132668104848]
//     ].map(([year, sex, name, n, prop]) => ({ year, sex, name, n, prop }))

//   // group the data: one array for each value of the X axis.
//   var sumstat = d3.nest()
//     .key(function(d) { return d.year;})
//     .entries(data);

//   // Stack the data: each group will be represented on top of each other
//   var mygroups = ["Helen", "Amanda", "Ashley"] // list of group names
//   var mygroup = [1,2,3] // list of group names
//   var stackedData = d3.stack()
//     .keys(mygroup)
//     .value(function(d, key){
//       return d.values[key].n
//     })
//     (sumstat)

//   // Add X axis --> it is a date format
//   var x = d3.scaleLinear()
//     .domain(d3.extent(data, function(d) { return d.year; }))
//     .range([ 0, width ]);
//   svg.append("g")
//     .attr("transform", "translate(0," + height + ")")
//     .call(d3.axisBottom(x).ticks(5));

//   // Add Y axis
//   var y = d3.scaleLinear()
//     .domain([0, d3.max(data, function(d) { return +d.n; })*1.2])
//     .range([ height, 0 ]);
//   svg.append("g")
//     .call(d3.axisLeft(y));

//   // color palette
//   var color = d3.scaleOrdinal()
//     .domain(mygroups)
//     .range(['#e41a1c','#377eb8','#4daf4a','#984ea3','#ff7f00','#ffff33','#a65628','#f781bf','#999999'])

//   // Show the areas
//   svg
//     .selectAll("mylayers")
//     .data(stackedData)
//     .enter()
//     .append("path")
//       .style("fill", function(d) { name = mygroups[d.key-1] ;  return color(name); })
//       .attr("d", d3.area()
//         .x(function(d, i) { return x(d.data.key); })
//         .y0(function(d) { return y(d[0]); })
//         .y1(function(d) { return y(d[1]); })
//     )

// })

// <svg width="460" height="400">
//    <g transform="translate(60,10)">
//       <g transform="translate(0,360)" fill="none" font-size="10" font-family="sans-serif" text-anchor="middle">
//          <path class="domain" stroke="#000" d="M0.5,6V0.5H370.5V6"></path>
//          <g class="tick" opacity="1" transform="translate(0.5,0)">
//             <line stroke="#000" y2="6"></line>
//             <text fill="#000" y="9" dy="0.71em">1,880</text>
//          </g>
//          <g class="tick" opacity="1" transform="translate(55.31481481481481,0)">
//             <line stroke="#000" y2="6"></line>
//             <text fill="#000" y="9" dy="0.71em">1,900</text>
//          </g>
//          <g class="tick" opacity="1" transform="translate(110.12962962962962,0)">
//             <line stroke="#000" y2="6"></line>
//             <text fill="#000" y="9" dy="0.71em">1,920</text>
//          </g>
//          <g class="tick" opacity="1" transform="translate(164.94444444444443,0)">
//             <line stroke="#000" y2="6"></line>
//             <text fill="#000" y="9" dy="0.71em">1,940</text>
//          </g>
//          <g class="tick" opacity="1" transform="translate(219.75925925925924,0)">
//             <line stroke="#000" y2="6"></line>
//             <text fill="#000" y="9" dy="0.71em">1,960</text>
//          </g>
//          <g class="tick" opacity="1" transform="translate(274.5740740740741,0)">
//             <line stroke="#000" y2="6"></line>
//             <text fill="#000" y="9" dy="0.71em">1,980</text>
//          </g>
//          <g class="tick" opacity="1" transform="translate(329.38888888888886,0)">
//             <line stroke="#000" y2="6"></line>
//             <text fill="#000" y="9" dy="0.71em">2,000</text>
//          </g>
//       </g>
//       <g fill="none" font-size="10" font-family="sans-serif" text-anchor="end">
//          <path class="domain" stroke="#000" d="M-6,360.5H0.5V0.5H-6"></path>
//          <g class="tick" opacity="1" transform="translate(0,360.5)">
//             <line stroke="#000" x2="-6"></line>
//             <text fill="#000" x="-9" dy="0.32em">0</text>
//          </g>
//          <g class="tick" opacity="1" transform="translate(0,330.4036918138042)">
//             <line stroke="#000" x2="-6"></line>
//             <text fill="#000" x="-9" dy="0.32em">10,000</text>
//          </g>
//          <g class="tick" opacity="1" transform="translate(0,300.3073836276084)">
//             <line stroke="#000" x2="-6"></line>
//             <text fill="#000" x="-9" dy="0.32em">20,000</text>
//          </g>
//          <g class="tick" opacity="1" transform="translate(0,270.2110754414125)">
//             <line stroke="#000" x2="-6"></line>
//             <text fill="#000" x="-9" dy="0.32em">30,000</text>
//          </g>
//          <g class="tick" opacity="1" transform="translate(0,240.1147672552167)">
//             <line stroke="#000" x2="-6"></line>
//             <text fill="#000" x="-9" dy="0.32em">40,000</text>
//          </g>
//          <g class="tick" opacity="1" transform="translate(0,210.01845906902088)">
//             <line stroke="#000" x2="-6"></line>
//             <text fill="#000" x="-9" dy="0.32em">50,000</text>
//          </g>
//          <g class="tick" opacity="1" transform="translate(0,179.92215088282504)">
//             <line stroke="#000" x2="-6"></line>
//             <text fill="#000" x="-9" dy="0.32em">60,000</text>
//          </g>
//          <g class="tick" opacity="1" transform="translate(0,149.8258426966292)">
//             <line stroke="#000" x2="-6"></line>
//             <text fill="#000" x="-9" dy="0.32em">70,000</text>
//          </g>
//          <g class="tick" opacity="1" transform="translate(0,119.72953451043338)">
//             <line stroke="#000" x2="-6"></line>
//             <text fill="#000" x="-9" dy="0.32em">80,000</text>
//          </g>
//          <g class="tick" opacity="1" transform="translate(0,89.63322632423757)">
//             <line stroke="#000" x2="-6"></line>
//             <text fill="#000" x="-9" dy="0.32em">90,000</text>
//          </g>
//          <g class="tick" opacity="1" transform="translate(0,59.536918138041756)">
//             <line stroke="#000" x2="-6"></line>
//             <text fill="#000" x="-9" dy="0.32em">100,000</text>
//          </g>
//          <g class="tick" opacity="1" transform="translate(0,29.440609951845886)">
//             <line stroke="#000" x2="-6"></line>
//             <text fill="#000" x="-9" dy="0.32em">110,000</text>
//          </g>
//       </g>
//       <path style="fill: rgb(228, 26, 28);" d="M0,359.2746789727127L2.740740740740741,359.20846709470305L5.481481481481482,359.13322632423757L8.222222222222223,359.1362359550562L10.962962962962964,358.9857544141252L13.703703703703702,358.97973515248793L16.444444444444446,358.88643659711073L19.185185185185183,358.9827447833066L21.925925925925927,358.7841091492777L24.666666666666668,358.7570224719101L27.407407407407405,358.62158908507223L30.148148148148152,358.2965489566613L32.88888888888889,358.11597110754417L35.629629629629626,357.52909309791335L38.37037037037037,356.8338683788122L41.11111111111111,356.6081460674157L43.851851851851855,355.88884430176563L46.59259259259259,355.569823434992L49.333333333333336,354.97090690208665L52.074074074074076,354.9227528089888L54.81481481481481,352.5030096308186L57.55555555555556,353.46007223113963L60.296296296296305,351.8529293739968L63.03703703703704,350.7363563402889L65.77777777777779,349.5355136436597L68.51851851851852,348.1510834670947L71.25925925925925,346.9803370786517L74,345.05116372391655L76.74074074074073,342.8360754414125L79.48148148148148,341.18077849117174L82.22222222222221,337.9755216693419L84.96296296296296,333.3075842696629L87.70370370370371,321.9432182985554L90.44444444444444,315.83667736757627L93.18518518518518,303.473113964687L95.92592592592592,284.29574638844304L98.66666666666667,277.49097110754417L101.4074074074074,273.1631219903692L104.14814814814815,263.5894863563403L106.88888888888889,264.49237560192614L109.62962962962962,254.3679775280899L112.37037037037037,255.20766452648473L115.11111111111111,262.16593097913324L117.85185185185186,265.2207062600321L120.59259259259261,266.12058587479936L123.33333333333333,261.23294542536115L126.07407407407408,260.8055778491172L128.8148148148148,253.39285714285714L131.55555555555557,258.4911717495987L134.2962962962963,265.26585072231137L137.03703703703704,268.4951845906902L139.77777777777777,280.18158105939006L142.5185185185185,284.85553772070625L145.25925925925927,293.6376404494382L148,295.9550561797753L150.74074074074073,291.1516853932584L153.48148148148147,288.03370786516854L156.22222222222223,283.7720706260032L158.96296296296296,283.2483948635634L161.70370370370372,288.8553370786517L164.44444444444443,293.56540930979133L167.1851851851852,288.6266051364366L169.92592592592592,264.86256019261634L172.66666666666666,244.3188202247191L175.40740740740742,249.02889245585874L178.14814814814815,252.13483146067415L180.88888888888889,220.66914125200643L183.62962962962962,205.6841894060995L186.37037037037035,221.15068218298555L189.1111111111111,220.5427367576244L191.85185185185185,215.68218298555377L194.59259259259258,190.1575040128411L197.33333333333334,200.21869983948636L200.07407407407408,202.90930979133228L202.8148148148148,195.45144462279293L205.55555555555557,205.66914125200643L208.2962962962963,216.05236757624397L211.03703703703707,239.41914125200643L213.77777777777777,245.83868378812198L216.5185185185185,253.99779293739968L219.25925925925924,263.36978330658104L222,273.1209871589085L224.74074074074073,280.1304173354735L227.4814814814815,283.66673354735155L230.22222222222223,288.8733948635634L232.96296296296296,301.7967495987159L235.70370370370372,311.0934991974318L238.44444444444446,317.8441011235955L241.18518518518522,323.0236757624398L243.9259259259259,326.3342696629214L246.66666666666666,330.34610754414126L249.4074074074074,333.89145264847514L252.14814814814815,341.10252808988764L254.88888888888889,338.2524077046549L257.6296296296296,335.8025682182986L260.3703703703704,321.9191412520064L263.11111111111114,313.0768459069021L265.85185185185185,304.983948635634L268.5925925925926,298.2363563402889L271.3333333333333,276.40148475120384L274.0740740740741,257.9103130016051L276.8148148148148,256.54995987158907L279.55555555555554,257.0405296950241L282.2962962962963,258.4129213483146L285.037037037037,243.34971910112358L287.77777777777777,218.5262841091493L290.51851851851853,210.49959871589084L293.2592592592593,194.93679775280899L296,209.6298154093098L298.74074074074076,216.78671749598715L301.48148148148147,222.90228731942216L304.22222222222223,229.40008025682184L306.96296296296293,244.57463884430177L309.7037037037037,255.12339486356342L312.44444444444446,268.8743980738363L315.18518518518516,279.9347913322632L317.9259259259259,288.7439807383628L320.6666666666667,297.1137640449438L323.40740740740745,305.12540128410916L326.14814814814815,310.8045746388443L328.88888888888886,312.73374799357947L331.6296296296296,318.1149678972713L334.3703703703704,324.14626805778494L337.1111111111111,328.56440609951846L339.85185185185185,331.5018057784912L342.5925925925926,335.59791332263245L345.3333333333333,339.50742375601925L348.0740740740741,342.8330658105939L350.81481481481484,345.7584269662921L353.5555555555556,348.5844703049759L356.2962962962963,350.38422953451044L359.037037037037,352.1147672552167L361.77777777777777,352.99658908507223L364.51851851851853,354.14325842696627L367.25925925925924,354.61276083467095L370,355.25381219903693L370,360L367.25925925925924,360L364.51851851851853,360L361.77777777777777,360L359.037037037037,360L356.2962962962963,360L353.5555555555556,360L350.81481481481484,360L348.0740740740741,360L345.3333333333333,360L342.5925925925926,360L339.85185185185185,360L337.1111111111111,360L334.3703703703704,360L331.6296296296296,360L328.88888888888886,360L326.14814814814815,360L323.40740740740745,360L320.6666666666667,360L317.9259259259259,360L315.18518518518516,360L312.44444444444446,360L309.7037037037037,360L306.96296296296293,360L304.22222222222223,360L301.48148148148147,360L298.74074074074076,360L296,360L293.2592592592593,360L290.51851851851853,360L287.77777777777777,360L285.037037037037,360L282.2962962962963,360L279.55555555555554,360L276.8148148148148,360L274.0740740740741,360L271.3333333333333,360L268.5925925925926,360L265.85185185185185,360L263.11111111111114,360L260.3703703703704,360L257.6296296296296,360L254.88888888888889,360L252.14814814814815,360L249.4074074074074,360L246.66666666666666,360L243.9259259259259,360L241.18518518518522,360L238.44444444444446,360L235.70370370370372,360L232.96296296296296,360L230.22222222222223,360L227.4814814814815,360L224.74074074074073,360L222,360L219.25925925925924,360L216.5185185185185,360L213.77777777777777,360L211.03703703703707,360L208.2962962962963,360L205.55555555555557,360L202.8148148148148,360L200.07407407407408,360L197.33333333333334,360L194.59259259259258,360L191.85185185185185,360L189.1111111111111,360L186.37037037037035,360L183.62962962962962,360L180.88888888888889,360L178.14814814814815,360L175.40740740740742,360L172.66666666666666,360L169.92592592592592,360L167.1851851851852,360L164.44444444444443,360L161.70370370370372,360L158.96296296296296,360L156.22222222222223,360L153.48148148148147,360L150.74074074074073,360L148,360L145.25925925925927,360L142.5185185185185,360L139.77777777777777,360L137.03703703703704,360L134.2962962962963,360L131.55555555555557,360L128.8148148148148,360L126.07407407407408,360L123.33333333333333,360L120.59259259259261,360L117.85185185185186,360L115.11111111111111,360L112.37037037037037,360L109.62962962962962,360L106.88888888888889,360L104.14814814814815,360L101.4074074074074,360L98.66666666666667,360L95.92592592592592,360L93.18518518518518,360L90.44444444444444,360L87.70370370370371,360L84.96296296296296,360L82.22222222222221,360L79.48148148148148,360L76.74074074074073,360L74,360L71.25925925925925,360L68.51851851851852,360L65.77777777777779,360L63.03703703703704,360L60.296296296296305,360L57.55555555555556,360L54.81481481481481,360L52.074074074074076,360L49.333333333333336,360L46.59259259259259,360L43.851851851851855,360L41.11111111111111,360L38.37037037037037,360L35.629629629629626,360L32.88888888888889,360L30.148148148148152,360L27.407407407407405,360L24.666666666666668,360L21.925925925925927,360L19.185185185185183,360L16.444444444444446,360L13.703703703703702,360L10.962962962962964,360L8.222222222222223,360L5.481481481481482,360L2.740740740740741,360L0,360Z"></path>
//       <path style="fill: rgb(55, 126, 184);" d="M0,358.92255216693417L2.740740740740741,358.8713884430177L5.481481481481482,358.76304173354737L8.222222222222223,358.7118780096308L10.962962962962964,358.4951845906902L13.703703703703702,358.3898475120385L16.444444444444446,358.19422150882826L19.185185185185183,358.16412520064205L21.925925925925927,357.6615168539326L24.666666666666668,357.62239165329055L27.407407407407405,357.44181380417336L30.148148148148152,357.1799759229535L32.88888888888889,356.74658908507223L35.629629629629626,356.36436597110753L38.37037037037037,355.5758426966292L41.11111111111111,355.3109951845907L43.851851851851855,354.78430979133225L46.59259259259259,354.4652889245586L49.333333333333336,353.7038523274478L52.074074074074076,353.68880417335475L54.81481481481481,350.5046147672552L57.55555555555556,352.033507223114L60.296296296296305,350.10734349919744L63.03703703703704,348.9426163723916L65.77777777777779,347.40770465489567L68.51851851851852,345.7223113964687L71.25925925925925,344.37700642054574L74,341.9873595505618L76.74074074074073,339.44121187800965L79.48148148148148,337.92435794542536L82.22222222222221,333.79514446227927L84.96296296296296,328.92556179775283L87.70370370370371,315.89085072231137L90.44444444444444,309.098113964687L93.18518518518518,294.6458667736758L95.92592592592592,271.7094703049759L98.66666666666667,262.03350722311393L101.4074074074074,253.18218298555377L104.14814814814815,237.0987158908507L106.88888888888889,234.07403691813803L109.62962962962962,212.1819823434992L112.37037037037037,202.1268057784912L115.11111111111111,199.28571428571428L117.85185185185186,187.00040128410916L120.59259259259261,174.01986356340288L123.33333333333333,173.4480337078652L126.07407407407408,179.89466292134833L128.8148148148148,177.20104333868377L131.55555555555557,189.46227929373998L134.2962962962963,202.1147672552167L137.03703703703704,208.56139646869985L139.77777777777777,227.04052969502408L142.5185185185185,230.70926966292134L145.25925925925927,237.5832664526485L148,233.21328250401285L150.74074074074073,232.76484751203853L153.48148148148147,234.85955056179773L156.22222222222223,233.8994783306581L158.96296296296296,234.04695024077046L161.70370370370372,243.1992375601926L164.44444444444443,238.28451043338683L167.1851851851852,225.72532102728732L169.92592592592592,199.69201444622792L172.66666666666666,179.32584269662922L175.40740740740742,189.56761637239165L178.14814814814815,196.80878812199037L180.88888888888889,161.33727929373998L183.62962962962962,148.61556982343498L186.37037037037035,171.12459871589087L189.1111111111111,162.73374799357947L191.85185185185185,128.18318619582666L194.59259259259258,63.61757624398075L197.33333333333334,50.311998394863565L200.07407407407408,49.3970706260032L202.8148148148148,47.579253611556965L205.55555555555557,66.59410112359552L208.2962962962963,85.63904494382024L211.03703703703707,121.20987158908508L213.77777777777777,146.71348314606743L216.5185185185185,165.05718298555377L219.25925925925924,187.31942215088282L222,200.61296147672553L224.74074074074073,211.2309390048154L227.4814814814815,220.27788924558587L230.22222222222223,230.76946227929375L232.96296296296296,250.38322632423757L235.70370370370372,264.2636436597111L238.44444444444446,278.11998394863565L241.18518518518522,288.8101926163724L243.9259259259259,295.4915730337079L246.66666666666666,304.0599919743178L249.4074074074074,311.68338683788124L252.14814814814815,322.4187399678973L254.88888888888889,321.3172150882825L257.6296296296296,313.3025682182986L260.3703703703704,300.68318619582664L263.11111111111114,294.96789727126804L265.85185185185185,287.20605939004815L268.5925925925926,281.68940609951846L271.3333333333333,259.3940609951846L274.0740740740741,235.95204654895667L276.8148148148148,229.83346709470305L279.55555555555554,212.34450240770465L282.2962962962963,158.2223113964687L285.037037037037,141.30517656500803L287.77777777777777,101.00020064205455L290.51851851851853,88.54333868378808L293.2592592592593,69.1763643659711L296,90.89686998394865L298.74074074074076,105.95104333868377L301.48148148148147,119.35593900481541L304.22222222222223,142.46087479935795L306.96296296296293,169.23154093097912L309.7037037037037,192.4959871589085L312.44444444444446,212.5491573033708L315.18518518518516,230.74237560192617L317.9259259259259,246.69040930979133L320.6666666666667,260.27889245585874L323.40740740740745,272.29634831460675L326.14814814814815,281.48776083467095L328.88888888888886,287.00140449438203L331.6296296296296,297.1589085072231L334.3703703703704,305.69121187800965L337.1111111111111,312.4959871589085L339.85185185185185,317.4257624398074L342.5925925925926,323.29454253611556L345.3333333333333,329.41011235955057L348.0740740740741,333.6898073836276L350.81481481481484,338.417937399679L353.5555555555556,342.7096709470305L356.2962962962963,345.403290529695L359.037037037037,347.8741974317817L361.77777777777777,349.3007624398074L364.51851851851853,350.94101123595505L367.25925925925924,351.4586677367576L370,352.2050561797753L370,355.25381219903693L367.25925925925924,354.61276083467095L364.51851851851853,354.14325842696627L361.77777777777777,352.99658908507223L359.037037037037,352.1147672552167L356.2962962962963,350.38422953451044L353.5555555555556,348.5844703049759L350.81481481481484,345.7584269662921L348.0740740740741,342.8330658105939L345.3333333333333,339.50742375601925L342.5925925925926,335.59791332263245L339.85185185185185,331.5018057784912L337.1111111111111,328.56440609951846L334.3703703703704,324.14626805778494L331.6296296296296,318.1149678972713L328.88888888888886,312.73374799357947L326.14814814814815,310.8045746388443L323.40740740740745,305.12540128410916L320.6666666666667,297.1137640449438L317.9259259259259,288.7439807383628L315.18518518518516,279.9347913322632L312.44444444444446,268.8743980738363L309.7037037037037,255.12339486356342L306.96296296296293,244.57463884430177L304.22222222222223,229.40008025682184L301.48148148148147,222.90228731942216L298.74074074074076,216.78671749598715L296,209.6298154093098L293.2592592592593,194.93679775280899L290.51851851851853,210.49959871589084L287.77777777777777,218.5262841091493L285.037037037037,243.34971910112358L282.2962962962963,258.4129213483146L279.55555555555554,257.0405296950241L276.8148148148148,256.54995987158907L274.0740740740741,257.9103130016051L271.3333333333333,276.40148475120384L268.5925925925926,298.2363563402889L265.85185185185185,304.983948635634L263.11111111111114,313.0768459069021L260.3703703703704,321.9191412520064L257.6296296296296,335.8025682182986L254.88888888888889,338.2524077046549L252.14814814814815,341.10252808988764L249.4074074074074,333.89145264847514L246.66666666666666,330.34610754414126L243.9259259259259,326.3342696629214L241.18518518518522,323.0236757624398L238.44444444444446,317.8441011235955L235.70370370370372,311.0934991974318L232.96296296296296,301.7967495987159L230.22222222222223,288.8733948635634L227.4814814814815,283.66673354735155L224.74074074074073,280.1304173354735L222,273.1209871589085L219.25925925925924,263.36978330658104L216.5185185185185,253.99779293739968L213.77777777777777,245.83868378812198L211.03703703703707,239.41914125200643L208.2962962962963,216.05236757624397L205.55555555555557,205.66914125200643L202.8148148148148,195.45144462279293L200.07407407407408,202.90930979133228L197.33333333333334,200.21869983948636L194.59259259259258,190.1575040128411L191.85185185185185,215.68218298555377L189.1111111111111,220.5427367576244L186.37037037037035,221.15068218298555L183.62962962962962,205.6841894060995L180.88888888888889,220.66914125200643L178.14814814814815,252.13483146067415L175.40740740740742,249.02889245585874L172.66666666666666,244.3188202247191L169.92592592592592,264.86256019261634L167.1851851851852,288.6266051364366L164.44444444444443,293.56540930979133L161.70370370370372,288.8553370786517L158.96296296296296,283.2483948635634L156.22222222222223,283.7720706260032L153.48148148148147,288.03370786516854L150.74074074074073,291.1516853932584L148,295.9550561797753L145.25925925925927,293.6376404494382L142.5185185185185,284.85553772070625L139.77777777777777,280.18158105939006L137.03703703703704,268.4951845906902L134.2962962962963,265.26585072231137L131.55555555555557,258.4911717495987L128.8148148148148,253.39285714285714L126.07407407407408,260.8055778491172L123.33333333333333,261.23294542536115L120.59259259259261,266.12058587479936L117.85185185185186,265.2207062600321L115.11111111111111,262.16593097913324L112.37037037037037,255.20766452648473L109.62962962962962,254.3679775280899L106.88888888888889,264.49237560192614L104.14814814814815,263.5894863563403L101.4074074074074,273.1631219903692L98.66666666666667,277.49097110754417L95.92592592592592,284.29574638844304L93.18518518518518,303.473113964687L90.44444444444444,315.83667736757627L87.70370370370371,321.9432182985554L84.96296296296296,333.3075842696629L82.22222222222221,337.9755216693419L79.48148148148148,341.18077849117174L76.74074074074073,342.8360754414125L74,345.05116372391655L71.25925925925925,346.9803370786517L68.51851851851852,348.1510834670947L65.77777777777779,349.5355136436597L63.03703703703704,350.7363563402889L60.296296296296305,351.8529293739968L57.55555555555556,353.46007223113963L54.81481481481481,352.5030096308186L52.074074074074076,354.9227528089888L49.333333333333336,354.97090690208665L46.59259259259259,355.569823434992L43.851851851851855,355.88884430176563L41.11111111111111,356.6081460674157L38.37037037037037,356.8338683788122L35.629629629629626,357.52909309791335L32.88888888888889,358.11597110754417L30.148148148148152,358.2965489566613L27.407407407407405,358.62158908507223L24.666666666666668,358.7570224719101L21.925925925925927,358.7841091492777L19.185185185185183,358.9827447833066L16.444444444444446,358.88643659711073L13.703703703703702,358.97973515248793L10.962962962962964,358.9857544141252L8.222222222222223,359.1362359550562L5.481481481481482,359.13322632423757L2.740740740740741,359.20846709470305L0,359.2746789727127Z"></path>
//       <path style="fill: rgb(77, 175, 74);" d="M0,358.5854735152488L2.740740740740741,358.54333868378814L5.481481481481482,358.4169341894061L8.222222222222223,358.35072231139645L10.962962962962964,358.061797752809L13.703703703703702,357.9233547351525L16.444444444444446,357.69161316211876L19.185185185185183,357.62841091492777L21.925925925925927,357.017455858748L24.666666666666668,357.05357142857144L27.407407407407405,356.7917335473515L30.148148148148152,356.46067415730334L32.88888888888889,355.9791332263242L35.629629629629626,355.4674959871589L38.37037037037037,354.6789727126806L41.11111111111111,354.25762439807386L43.851851851851855,353.75501605136435L46.59259259259259,353.39987961476726L49.333333333333336,352.58727929374L52.074074074074076,352.70766452648473L54.81481481481481,349.36998394863565L57.55555555555556,351.0794542536116L60.296296296296305,349.20144462279296L63.03703703703704,348.1992375601926L65.77777777777779,346.5228731942215L68.51851851851852,344.786316211878L71.25925925925925,343.5945024077047L74,341.1296147672552L76.74074074074073,338.65870786516854L79.48148148148148,337.10874799357947L82.22222222222221,332.8441011235955L84.96296296296296,327.9474317817014L87.70370370370371,314.37399678972713L90.44444444444444,307.3284510433387L93.18518518518518,292.67154895666135L95.92592592592592,269.01585072231137L98.66666666666667,258.78912520064205L101.4074074074074,248.84530497592294L104.14814814814815,231.80176565008026L106.88888888888889,227.62138844301765L109.62962962962962,204.651886035313L112.37037037037037,191.94823434991974L115.11111111111111,187.54213483146066L117.85185185185186,172.55417335473516L120.59259259259261,153.07885232744783L123.33333333333333,149.08507223113966L126.07407407407408,154.0419341894061L128.8148148148148,145.44040930979136L131.55555555555557,152.34751203852326L134.2962962962963,161.10553772070628L137.03703703703704,161.16272070626005L139.77777777777777,177.47792937399677L142.5185185185185,181.42656500802568L145.25925925925927,193.50722311396467L148,190.78049759229535L150.74074074074073,194.3077849117175L153.48148148148147,198.04574638844304L156.22222222222223,199.43318619582664L158.96296296296296,201.44361958266452L161.70370370370372,210.9540529695024L164.44444444444443,193.51926163723917L167.1851851851852,181.90208667736758L169.92592592592592,154.45124398073838L172.66666666666666,134.82845104333867L175.40740740740742,149.30477528089887L178.14814814814815,159.70605939004815L180.88888888888889,122.82604333868377L183.62962962962962,110.23976725521669L186.37037037037035,137.03752006420547L189.1111111111111,117.75180577849116L191.85185185185185,87.21007223113963L194.59259259259258,25.034109149277697L197.33333333333334,13.820224719101134L200.07407407407408,15.186597110754406L202.8148148148148,15.63202247191009L205.55555555555557,36.714486356340274L208.2962962962963,57.91131621187799L211.03703703703707,95.70626003210276L213.77777777777777,123.51223916532905L216.5185185185185,143.0357142857143L219.25925925925924,167.74779293739968L222,183.81922150882826L224.74074074074073,196.89004815409308L227.4814814814815,207.77588282504013L230.22222222222223,218.5292937399679L232.96296296296296,239.65389245585874L235.70370370370372,255.39125200642053L238.44444444444446,270.1053370786517L241.18518518518522,281.49678972712684L243.9259259259259,287.0134430176565L246.66666666666666,291.9522471910112L249.4074074074074,295.55176565008026L252.14814814814815,305.12540128410916L254.88888888888889,306.3172150882825L257.6296296296296,300.22572231139645L260.3703703703704,290.0742375601926L263.11111111111114,285.51464686998395L265.85185185185185,278.4510433386838L268.5925925925926,271.20385232744786L271.3333333333333,246.00120385232745L274.0740740740741,219.9739165329053L276.8148148148148,213.92756821829855L279.55555555555554,196.79373996789727L282.2962962962963,143.4089085072231L285.037037037037,127.8370786516854L287.77777777777777,87.76384430176563L290.51851851851853,75.7644462279294L293.2592592592593,57.39967897271265L296,79.46629213483146L298.74074074074076,95.09831460674155L301.48148148148147,108.58747993579453L304.22222222222223,132.17395666131623L306.96296296296293,160.35012038523274L309.7037037037037,184.49036918138043L312.44444444444446,205.43739967897272L315.18518518518516,224.24157303370788L317.9259259259259,240.76143659711076L320.6666666666667,254.91873996789727L323.40740740740745,267.167937399679L326.14814814814815,276.87700642054574L328.88888888888886,282.81199839486356L331.6296296296296,293.47813001605135L334.3703703703704,302.341492776886L337.1111111111111,309.4532504012841L339.85185185185185,314.4251605136437L342.5925925925926,320.40529695024077L345.3333333333333,326.5569823434992L348.0740740740741,330.88784109149276L350.81481481481484,335.75742375601925L353.5555555555556,340.2237158908507L356.2962962962963,343.28752006420547L359.037037037037,345.680176565008L361.77777777777777,346.9773274478331L364.51851851851853,348.7199036918138L367.25925925925924,349.0479534510433L370,349.92676565008026L370,352.2050561797753L367.25925925925924,351.4586677367576L364.51851851851853,350.94101123595505L361.77777777777777,349.3007624398074L359.037037037037,347.8741974317817L356.2962962962963,345.403290529695L353.5555555555556,342.7096709470305L350.81481481481484,338.417937399679L348.0740740740741,333.6898073836276L345.3333333333333,329.41011235955057L342.5925925925926,323.29454253611556L339.85185185185185,317.4257624398074L337.1111111111111,312.4959871589085L334.3703703703704,305.69121187800965L331.6296296296296,297.1589085072231L328.88888888888886,287.00140449438203L326.14814814814815,281.48776083467095L323.40740740740745,272.29634831460675L320.6666666666667,260.27889245585874L317.9259259259259,246.69040930979133L315.18518518518516,230.74237560192617L312.44444444444446,212.5491573033708L309.7037037037037,192.4959871589085L306.96296296296293,169.23154093097912L304.22222222222223,142.46087479935795L301.48148148148147,119.35593900481541L298.74074074074076,105.95104333868377L296,90.89686998394865L293.2592592592593,69.1763643659711L290.51851851851853,88.54333868378808L287.77777777777777,101.00020064205455L285.037037037037,141.30517656500803L282.2962962962963,158.2223113964687L279.55555555555554,212.34450240770465L276.8148148148148,229.83346709470305L274.0740740740741,235.95204654895667L271.3333333333333,259.3940609951846L268.5925925925926,281.68940609951846L265.85185185185185,287.20605939004815L263.11111111111114,294.96789727126804L260.3703703703704,300.68318619582664L257.6296296296296,313.3025682182986L254.88888888888889,321.3172150882825L252.14814814814815,322.4187399678973L249.4074074074074,311.68338683788124L246.66666666666666,304.0599919743178L243.9259259259259,295.4915730337079L241.18518518518522,288.8101926163724L238.44444444444446,278.11998394863565L235.70370370370372,264.2636436597111L232.96296296296296,250.38322632423757L230.22222222222223,230.76946227929375L227.4814814814815,220.27788924558587L224.74074074074073,211.2309390048154L222,200.61296147672553L219.25925925925924,187.31942215088282L216.5185185185185,165.05718298555377L213.77777777777777,146.71348314606743L211.03703703703707,121.20987158908508L208.2962962962963,85.63904494382024L205.55555555555557,66.59410112359552L202.8148148148148,47.579253611556965L200.07407407407408,49.3970706260032L197.33333333333334,50.311998394863565L194.59259259259258,63.61757624398075L191.85185185185185,128.18318619582666L189.1111111111111,162.73374799357947L186.37037037037035,171.12459871589087L183.62962962962962,148.61556982343498L180.88888888888889,161.33727929373998L178.14814814814815,196.80878812199037L175.40740740740742,189.56761637239165L172.66666666666666,179.32584269662922L169.92592592592592,199.69201444622792L167.1851851851852,225.72532102728732L164.44444444444443,238.28451043338683L161.70370370370372,243.1992375601926L158.96296296296296,234.04695024077046L156.22222222222223,233.8994783306581L153.48148148148147,234.85955056179773L150.74074074074073,232.76484751203853L148,233.21328250401285L145.25925925925927,237.5832664526485L142.5185185185185,230.70926966292134L139.77777777777777,227.04052969502408L137.03703703703704,208.56139646869985L134.2962962962963,202.1147672552167L131.55555555555557,189.46227929373998L128.8148148148148,177.20104333868377L126.07407407407408,179.89466292134833L123.33333333333333,173.4480337078652L120.59259259259261,174.01986356340288L117.85185185185186,187.00040128410916L115.11111111111111,199.28571428571428L112.37037037037037,202.1268057784912L109.62962962962962,212.1819823434992L106.88888888888889,234.07403691813803L104.14814814814815,237.0987158908507L101.4074074074074,253.18218298555377L98.66666666666667,262.03350722311393L95.92592592592592,271.7094703049759L93.18518518518518,294.6458667736758L90.44444444444444,309.098113964687L87.70370370370371,315.89085072231137L84.96296296296296,328.92556179775283L82.22222222222221,333.79514446227927L79.48148148148148,337.92435794542536L76.74074074074073,339.44121187800965L74,341.9873595505618L71.25925925925925,344.37700642054574L68.51851851851852,345.7223113964687L65.77777777777779,347.40770465489567L63.03703703703704,348.9426163723916L60.296296296296305,350.10734349919744L57.55555555555556,352.033507223114L54.81481481481481,350.5046147672552L52.074074074074076,353.68880417335475L49.333333333333336,353.7038523274478L46.59259259259259,354.4652889245586L43.851851851851855,354.78430979133225L41.11111111111111,355.3109951845907L38.37037037037037,355.5758426966292L35.629629629629626,356.36436597110753L32.88888888888889,356.74658908507223L30.148148148148152,357.1799759229535L27.407407407407405,357.44181380417336L24.666666666666668,357.62239165329055L21.925925925925927,357.6615168539326L19.185185185185183,358.16412520064205L16.444444444444446,358.19422150882826L13.703703703703702,358.3898475120385L10.962962962962964,358.4951845906902L8.222222222222223,358.7118780096308L5.481481481481482,358.76304173354737L2.740740740740741,358.8713884430177L0,358.92255216693417Z"></path>
//    </g>
// </svg>
