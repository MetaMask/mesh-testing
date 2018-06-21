const { createServerStream } = require('http-poll-stream')
const connectionStreams = {}

module.exports = createClientHandler

function createClientHandler ({ onNewConnection }) {
  return handleClientConnection

  function handleClientConnection (req, res) {
    const { connectionId } = req.params
    let connectionStream = connectionStreams[connectionId]
    // create client stream if it doesnt exist
    if (!connectionStream) {
      connectionStream = createServerStream({})
      connectionStreams[connectionId] = connectionStream
      onNewConnection({ connectionId, connectionStream, req })
    }
    // process data flow
    connectionStream.onRequest(req, res)
  }
}
