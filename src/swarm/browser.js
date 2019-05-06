'use strict'

const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ devtools: true })
  const exit = async () => {
    console.log('closing browsers before shutdown')
    await browser.close()
    // process.exit(0)
  }
  process.on('SIGINT', exit)
  process.on('SIGQUIT', exit)
  process.on('SIGTERM', exit)
  process.on('SIGHUP', exit)

  let instances = process.argv[2] || 5
  console.log(`launching ${instances} instances...`)
  let insts = 0
  while (insts = instances--) {
    const inst = insts
    const page = await browser.newPage()
    page.on('console', (msg) => {
      console.log(`INSTANCE ${inst}:`, msg.text())
    })
    await page.goto('http://localhost:9966')
    await page.evaluate((PUP_DEBUG) => {
      window.localStorage.debug = `'${PUP_DEBUG}'`
    }, process.env['PUP_DEBUG'])
    console.log(`${instances} remaining to start`)
  }
  console.log(`all done...`)
})()
