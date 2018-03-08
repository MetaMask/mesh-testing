
const ROLLOUT_THRESHOLD = 1000
const matchesThreshold = checkThreshold({ rolloutThreshold: ROLLOUT_THRESHOLD })
if (matchesThreshold) {
  console.log('threshold matched -- activating test')
  activateBundle()
} else if (location.hostname === 'localhost') {
  console.log('development detected -- activating test')
  activateBundle()
} else {
  console.log('threshold not matched -- skipping test')
}

function activateBundle(){
  console.log('tests temporarily disabled')
  return

  const script = document.createElement('script')
  script.src = './bundle.js'
  script.type = 'text/javascript'
  document.body.appendChild(script)
}

function checkThreshold({ rolloutThreshold }){
  // load or setup id
  let id = localStorage.getItem('id')
  if (!id) {
    id = generateId()
    localStorage.setItem('id', id)
  }

  // check if id matches parital rollout threshold
  const matchesThreshold = ((id % rolloutThreshold) === 0)
  return matchesThreshold
}

function generateId() {
  return Math.floor(Math.random() * 1e9)
}
