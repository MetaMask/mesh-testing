const qs = require('qs')
const setupAdmin = require('./src/admin/index')
const setupClient = require('./src/client/index')

start().catch(console.error)

async function start () {
  // parse params
  const opts = qs.parse(window.location.search, { ignoreQueryPrefix: true })
  const devMode = (!opts.prod && location.hostname === 'localhost')
  const adminCode = opts.admin

  if (adminCode) {
    await setupAdmin()
  } else {
    await setupClient()
  }
}
