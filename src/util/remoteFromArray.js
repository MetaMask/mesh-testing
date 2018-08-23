'use strict'

exports.removeFromArray = function removeFromArray (item, array) {
  const index = array.indexOf(item)
  if (index === -1) return
  array.splice(index, 1)
}
