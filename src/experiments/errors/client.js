class ErrorExperiment {
  constructor ({ node, clientId, maxErrorCount }) {
    const count = maxErrorCount || 5
    this.state = { errors: [] }
    // listen for app errors
    node.on('app:error', (label, err) => {
      // capture error data
      const { message, stack } = err
      const now = Date.now()
      this.state.errors.push({ label, message, stack, now })
      // limit errors to maximum
      this.state.errors = this.state.errors.slice(-1 * count)
    })
  }

  getState () {
    return this.state
  }
}

module.exports = ErrorExperiment