'use strict'
const concurrently = require('concurrently')
const colors = ['magenta', 'cyan', 'green', 'yellow', 'blue', 'red', 'white', 'gray', 'black']


start().catch(console.error)

async function start () {
  const procs = []
  let instances = process.argv[2] || 5
  console.log(`launching ${instances} instances...`)
  const tasks = Array(instances).fill().map((_, index) => {
    const scriptPath = __dirname + '/../client/index.js'
    const command = `node --inspect=:0 ${scriptPath}`
    // const instance = childProcess.spawn('node', [__dirname + 'client/index.js', 'dial=/ip4/127.0.0.1/tcp/50326/ipfs/QmSJY8gjJYArR4u3rTjANWkSLwr75dVTjnknvdfbe7uiCi'])
    const name = `node-${index}`
    const color = colors[index % colors.length]
    return { name, command, prefixColor: color }
  })
  await concurrently(tasks)
}
