const { detect } = require('detect-browser')

class PlatformExperiment {
  constructor () {
    this.state = detect()
  }
  getState () {
    return this.state
  }
}

module.exports = PlatformExperiment