const { compare, applyPatch, deepClone } = require('fast-json-patch')
const through = require('through2').obj

module.exports = { toDiffs, fromDiffs }

function toDiffs () {
  let lastObj = {}
  return through(function (newObj, _, cb) {
    try {
      const patch = compare(lastObj, newObj)
      // only push non-noop
      if (patch.length) this.push(patch)
      // deep clone to ensure diff is good
      // warning: increases memory footprint
      lastObj = deepClone(newObj)
    } catch (err) {
      console.log(`an error occurred patching json diff`, err)
    }
    cb()
  })
}

function fromDiffs () {
  let lastObj = {}
  return through(function (patch, _, cb) {
    try {
      const newObj = applyPatch(lastObj, patch).newDocument
      this.push(newObj)
      // deep clone to ensure diff is good
      // warning: increases memory footprint
      lastObj = deepClone(newObj)
    } catch (err) {
      console.log(`an error occurred patching json diff`, err)
    }
    cb()
  })
}
