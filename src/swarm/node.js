'use strict'
const concurrently = require('concurrently')
const colors = ['magenta', 'cyan', 'green', 'yellow', 'blue', 'red', 'white', 'gray', 'black']


start().catch(console.error)

async function start () {
  const procs = []
  let instances = Number(process.argv[2] || 5)
  console.log(`launching ${instances} instances...`)
  const tasks = Array(instances).fill().map((_, index) => {
    const scriptPath = __dirname + '/../client/index.js'
    const command = `node --inspect=:0 ${scriptPath}`
    const name = `node-${index}`
    const prefixColor = colors[index % colors.length]
    return { name, command, prefixColor }
  })
  const prefix = '{pid}-{name}'
  await concurrently(tasks, { prefix })
}
