const promiseToCallback = require('promise-to-callback')
const noop = function () {}

module.exports = { cbify, cbifyObj }

function cbifyObj (obj) {
  const newObj = {}
  Object.keys(obj).forEach(key => {
    const value = obj[key]
    if (typeof value === 'function') {
      newObj[key] = cbify(value, obj)
    } else {
      newObj[key] = value
    }
  })
  return newObj
}

function cbify (fn, context) {
  return function () {
    const args = [].slice.call(arguments)
    const lastArg = args[args.length - 1]
    const lastArgIsCallback = typeof lastArg === 'function'
    let callback
    if (lastArgIsCallback) {
      callback = lastArg
      args.pop()
    } else {
      callback = noop
    }
    let result = fn.apply(context, args)
    const isPromise = (result && result.then)
    if (!isPromise) result = Promise.resolve(result)
    promiseToCallback(result)(callback)
  }
}
