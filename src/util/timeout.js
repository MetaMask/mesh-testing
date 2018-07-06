module.exports = timeout

function timeout(timeoutDuration, value) {
  return new Promise((resolve) => setTimeout(() => resolve(value), timeoutDuration))
}
