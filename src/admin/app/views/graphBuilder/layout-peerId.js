const twoPi = 2 * Math.PI

module.exports = { posForNode }

function posForNode (peerIdHashString, radius) {
  const percent = peerIdHashToPercent(peerIdHashString)
  const pos = percentToPos(percent, radius, twoPi/4)
  return pos
}

function peerIdHashToPercent (peerIdHashString) {
  const accuracy = 2
  const prefixData = readBase64Bytes(peerIdHashString, accuracy)
  const prefixHexString = prefixData.slice(0, accuracy).toString('hex')
  const hashPrefixNum = Number.parseInt(prefixHexString, 16)
  const divisor = Math.pow(2, 8 * accuracy) - 1
  const percent = hashPrefixNum / divisor
  return percent
}

function readBase64Bytes (base64String, byteCount) {
  const charsToRead = Math.ceil(byteCount * 8 / 6)
  const base64Substring = base64String.slice(0, charsToRead)
  const prefixData = Buffer.from(base64Substring, 'base64')
  return prefixData
}

function percentToPos(percent, radius, offset = 0) {
  const x = radius * Math.cos(offset - percent * twoPi)
  const y = radius * Math.sin(offset - percent * twoPi)
  return { x, y }
}