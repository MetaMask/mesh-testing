module.exports = {
  interpolateColor,
  componentToHex,
  rgbToHex,
}

function interpolateColor(color1, color2, factor) {
  const result = color1.map((part, index) => {
    const color1Part = color1[index]
    const color2Part = color2[index]
    const diff = factor * (color2Part - color1Part)
    return Math.round(color1Part + diff)
  })
  return result
}

function componentToHex(c) {
  var hex = c.toString(16);
  return hex.length == 1 ? "0" + hex : hex;
}

function rgbToHex([r, g, b]) {
  return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
}