'use strict'

class BaseRPC {
  async ping () {
    return 'pong'
  }
}

module.exports = BaseRPC
