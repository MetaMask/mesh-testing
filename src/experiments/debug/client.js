class DebugExperiment {
  constructor ({ version, rpcInterface }) {
    this._bootTime = Date.now()
    this._version = version

    rpcInterface.debug = {
      refresh: async () => {
        return this.restart()
      },
      refreshLongDelay: async () => {
        return this.restartWithDelay(randomFromRange(2 * min, 10 * min))
      },
    }
  }

  getState() {
    return {
      version: this._version,
      uptime: Date.now() - this._bootTime,
    }
  }

  async restartWithRandomDelay (min, max) {
    const timeoutDuration = randomFromRange(min, max)
    await this.restartWithDelay(timeoutDuration)
  }

  async restartWithDelay (timeoutDuration) {
    console.log(`Telemetry - restarting in ${timeoutDuration / 1000} sec...`)
    setTimeout(() => this.restart(), timeoutDuration)
  }
  
  async restart () {
    if (!process.browser) {
      console.log('restart requested from telemetry server, but could not restart on non-browser platform')
      return
    }
    // await telemetryRpc.disconnect(clientId)
    window.location.reload()
  }

}

module.exports = DebugExperiment

function randomFromRange (min, max) {
  return Math.random() * (max - min) + min
}
