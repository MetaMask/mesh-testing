'use strict'

module.exports = function randomFromRange (min, max) {
  return min + Math.random() * (max - min)
}
