'use strict'

class KitsunetExperiment {
  constructor ({ kitsunet, rpcInterface }) {
    this._kitsunet = kitsunet

    rpcInterface.kitsunet = {
      enableBlockTracker
    }
  }

  getState () {
    return this._kitsunet.kitsunetStats.getState()
  }
}

module.exports = KitsunetExperiment