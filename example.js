var BuffGap = require('./')(dimension())

render()

setInterval(render, 1000)

process.on('SIGWINCH', noop)
process.stdout.on('resize', onResize)

function onResize () {
  BuffGap.resize(dimension())
  render()
}

function render () {
  var message =
    'Consider this a BuffGap trial\n' +
    'The time is: ' + new Date() + '\n' +
    'Enjoy the distributed ecosystem friends\n'

  process.stdout.write(BuffGap.update(message))
}

function dimension () {
  return {
    width: process.stdout.columns,
    height: process.stdout.rows
  }
}

function noop () {}
