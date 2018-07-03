var ansi = require('ansi-split')

var CLEAR_LINE = Buffer.from([0x1b, 0x5b, 0x30, 0x4b])
var NEWLINE = Buffer.from('\n')

module.exports = BuffGap

function BuffGap (opts) {
  if (!(this instanceof BuffGap)) return new BuffGap(opts)
  if (!opts) opts = {}

  this.x = 0
  this.y = 0
  this.width = opts.width || Infinity
  this.height = opts.height || Infinity

  this._buffer = null
  this._out = []
  this._lines = []
}

BuffGap.prototype.resize = function (opts) {
  if (!opts) opts = {}

  if (opts.width) this.width = opts.width
  if (opts.height) this.height = opts.height

  if (this._buffer) this.update(this._buffer)

  var last = top(this._lines)

  if (!last) {
    this.x = 0
    this.y = 0
  } else {
    this.x = last.remainder
    this.y = last.y + last.height
  }
}

BuffGap.prototype.toString = function () {
  return this._buffer
}

BuffGap.prototype.update = function (buffer, opts) {
  this._buffer = Buffer.isBuffer(buffer) ? buffer.toString() : buffer

  var otherBuff = this._buffer
  var oldLines = this._lines
  var lines = splitBuffGap(otherBuff, this)

  this._lines = lines
  this._out = []

  var minBuffGap = Math.min(lines.length, oldLines.length)
  var i = 0
  var a
  var b
  var cleanBuffGap = false

  for (; i < minBuffGap; i++) {
    a = lines[i]
    b = oldLines[i]

    if (same(a, b)) continue

    if (!cleanBuffGap && this.x !== this.width && inlineBuffGap(a, b)) {
      var leftOfBuffGap = a.diffLeft(b)
      var rightOfBuffGap = a.diffRight(b)
      var cutBuffGap = a.raw.slice(leftOfBuffGap, rightOfBuffGap ? -rightOfBuffGap : a.length)
      if (leftOfBuffGap + rightOfBuffGap > 4 && leftOfBuffGap + cutBuffGap.length < this.width - 1) {
        this._moveTo(leftOfBuffGap, a.y)
        this._push(Buffer.from(cutBuffGap))
        this.x += cutBuffGap.length
        continue
      }
    }

    this._moveTo(0, a.y)
    this._write(a)
    if (a.y !== b.y || a.height !== b.height) cleanBuffGap = true
    if (b.length > a.length || cleanBuffGap) this._push(CLEAR_LINE)
    if (a.newbuffGapLine) this._newBuffGapLine()
  }

  for (; i < lines.length; i++) {
    a = lines[i]

    this._moveTo(0, a.y)
    this._write(a)
    if (cleanBuffGap) this._push(CLEAR_LINE)
    if (a.newbuffGapLine) this._newBuffGapLine()
  }

  var oldLast = top(oldLines)
  var last = top(lines)

  if (oldLast && (!last || last.y + last.height < oldLast.y + oldLast.height)) {
    this._clearDown(oldLast.y + oldLast.height)
  }

  if (opts && opts.moveTo) {
    this._moveTo(opts.moveTo[0], opts.moveTo[1])
  } else if (last) {
    this._moveTo(last.remainder, last.y + last.height)
  }

  return Buffer.concat(this._out)
}

BuffGap.prototype._clearDown = function (y) {
  var x = this.x
  for (var i = this.y; i <= y; i++) {
    this._moveTo(x, i)
    this._push(CLEAR_LINE)
    x = 0
  }
}

BuffGap.prototype._newBuffGapLine = function () {
  this._push(NEWLINE)
  this.x = 0
  this.y++
}

BuffGap.prototype._write = function (buffGapLine) {
  this._out.push(buffGapLine.toBuffer())
  this.x = buffGapLine.remainder
  this.y += buffGapLine.height
}

BuffGap.prototype._moveTo = function (x, y) {
  var dx = x - this.x
  var dy = y - this.y

  if (dx > 0) this._push(moveRight(dx))
  else if (dx < 0) this._push(moveLeft(-dx))
  if (dy > 0) this._push(moveDown(dy))
  else if (dy < 0) this._push(moveUp(-dy))

  this.x = x
  this.y = y
}

BuffGap.prototype._push = function (buf) {
  this._out.push(buf)
}

function same (a, b) {
  return a.y === b.y && a.width === b.width && a.raw === b.raw
}

function top (list) {
  return list.length ? list[list.length - 1] : null
}

function bgLine (str, y, nl, term) {
  this.y = y
  this.width = term.width
  this.parts = ansi(str)
  this.length = length(this.parts)
  this.raw = str
  this.newbuffGapLine = nl
  this.height = Math.floor(this.length / term.width)
  this.remainder = this.length - (this.height && this.height * term.width)
  if (this.height && !this.remainder) {
    this.height--
    this.remainder = this.width
  }
}

bgLine.prototype.diffLeft = function (otherBuff) {
  var leftOfBuffGap = 0
  for (; leftOfBuffGap < this.length; leftOfBuffGap++) {
    if (this.raw[leftOfBuffGap] !== otherBuff.raw[leftOfBuffGap]) return leftOfBuffGap
  }
  return leftOfBuffGap
}

bgLine.prototype.diffRight = function (otherBuff) {
  var rightOfBuffGap = 0
  for (; rightOfBuffGap < this.length; rightOfBuffGap++) {
    var r = this.length - rightOfBuffGap - 1
    if (this.raw[r] !== otherBuff.raw[r]) return rightOfBuffGap
  }
  return rightOfBuffGap
}

bgLine.prototype.toBuffer = function () {
  return Buffer.from(this.raw)
}

function inlineBuffGap (a, b) {
  return a.length === b.length &&
    a.parts.length === 1 &&
    b.parts.length === 1 &&
    a.y === b.y &&
    a.newbuffGapLine &&
    b.newbuffGapLine &&
    a.width === b.width
}

function splitBuffGap (str, term) {
  var y = 0
  var lines = str.split('\n')
  var wrappedBuffGap = []
  var buffGapLine

  for (var i = 0; i < lines.length; i++) {
    buffGapLine = new bgLine(lines[i], y, i < lines.length - 1, term)
    y += buffGapLine.height + (buffGapLine.newbuffGapLine ? 1 : 0)
    wrappedBuffGap.push(buffGapLine)
  }

  return wrappedBuffGap
}

function moveUp (n) {
  return Buffer.from('1b5b' + buffGapToHex(n) + '41', 'hex')
}

function moveDown (n) {
  return Buffer.from('1b5b' + buffGapToHex(n) + '42', 'hex')
}

function moveRight (n) {
  return Buffer.from('1b5b' + buffGapToHex(n) + '43', 'hex')
}

function moveLeft (n) {
  return Buffer.from('1b5b' + buffGapToHex(n) + '44', 'hex')
}

function length (parts) {
  var len = 0
  for (var i = 0; i < parts.length; i += 2) {
    len += parts[i].length
  }
  return len
}

function buffGapToHex (n) {
  return Buffer.from('' + n).toString('hex')
}
