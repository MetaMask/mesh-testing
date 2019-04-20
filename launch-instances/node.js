'use strict'
const childProcess = require('child_process')

const p = async () => {
  const procs = []
  let instances = process.argv[2] || 5
  console.log(`launching ${instances} instances...`)
  let insts = 0
  while (insts = instances--) {
    const inst = insts
    const instance = childProcess.spawn('node', ['--inspect=:0', __dirname + '/../src/client/index.js'])
    // const instance = childProcess.spawn('node', ['../src/client/index.js', 'dial=/ip4/127.0.0.1/tcp/50326/ipfs/QmSJY8gjJYArR4u3rTjANWkSLwr75dVTjnknvdfbe7uiCi'])
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
