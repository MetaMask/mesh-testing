'use strict'
const childProcess = require('child_process')

const p = async () => {
  const procs = []
  let instances = process.argv[2] || 5
  console.log(`launching ${instances} instances...`)
  let insts = 0
  while (insts = instances--) {
    const inst = insts
    const instance = childProcess.spawn('/Users/dryajov/.nvm/versions/node/v9.11.1/bin/node',
      ['--inspect=:0', '/Users/dryajov/personal/projects/metamask/mesh-testing/src/client/index.js'])
    instance.stdout.on('data', (msg) => {
      console.log(`INSTANCE ${inst}:`, msg.toString())
    })

    instance.stderr.on('data', (msg) => {
      console.log(`INSTANCE ${inst}:`, msg.toString())
    })

    procs.push(instance)
    console.log(`${instances} remaining to start`)
  }
  console.log(`all done...`)
}

p()
