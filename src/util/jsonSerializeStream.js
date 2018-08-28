const through = require('through2').obj

module.exports = { createJsonSerializeStream, createJsonParseStream }

function createJsonSerializeStream () {
  return through(function (newObj, _, cb) {
    try {
      this.push(Buffer.from(JSON.stringify(newObj)))
    } catch (err) {
      console.log('Error serializing json, skipping: ', err)
    }
    cb()
  })
}

function createJsonParseStream () {
  return through(function (buffer, _, cb) {
    try {
      this.push(JSON.parse(buffer))
    } catch (err) {
      console.log('Error parsing json, skipping: ', err)
    }
    cb()
  })
}
