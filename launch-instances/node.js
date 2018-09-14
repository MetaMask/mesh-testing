'use strict'
const childProcess = require('child_process')

const p = async () => {
  const procs = []
  let instances = process.argv[2] || 5
  console.log(`launching ${instances} instances...`)
  let insts = 0
  while (insts = instances--) {
    const inst = insts
    const instance = childProcess.spawn('node',
      ['--inspect=:0', '../src/client/index.js'])
    instance.stdout.on('data', (msg) => {
      console.log(`INSTANCE ${inst}:`, msg.toString())
    })

    instance.stderr.on('data', (msg) => {
      console.error(`INSTANCE ${inst}:`, msg.toString())
    })

    procs.push(instance)
    console.log(`${instances} remaining to start`)
  }
  console.log(`all done...`)
}

p()
