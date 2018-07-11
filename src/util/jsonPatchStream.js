const { compare, applyPatch, deepClone } = require('fast-json-patch')
const through = require('through2').obj

module.exports = { toDiffs, fromDiffs }

function toDiffs() {
  let lastObj = {}
  return through(function (newObj, _, cb) {
    const patch = compare(lastObj, newObj)
    this.push(patch)
    // deep clone to ensure diff is good
    // warning: increases memory footprint
    lastObj = deepClone(newObj)
    cb()
  })
}

function fromDiffs() {
  let lastObj = {}
  return through(function (patch, _, cb) {
    const newObj = applyPatch(lastObj, patch).newDocument
    this.push(newObj)
    // deep clone to ensure diff is good
    // warning: increases memory footprint
    lastObj = deepClone(newObj)
    cb()
  })
}
