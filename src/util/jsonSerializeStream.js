const through = require('through2').obj

module.exports = { createJsonSerializeStream, createJsonParseStream }

function createJsonSerializeStream() {
  return through(function (newObj, _, cb) {
    this.push(Buffer.from(JSON.stringify(newObj)))
    cb()
  })
}

function createJsonParseStream() {
  return through(function (buffer, _, cb) {
    this.push(JSON.parse(buffer))
    cb()
  })
}
