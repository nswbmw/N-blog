module.exports = function (stream, options, callback) {
  if (typeof options === 'function') {
    callback = options
    options = {}
  }

  var limit = typeof options.limit === 'number'
    ? options.limit
    : null

  var expected = !isNaN(options.expected)
    ? parseInt(options.expected, 10)
    : null

  if (limit !== null && expected !== null && expected > limit) {
    var err = new Error('request entity too large')
    err.status = 413
    err.expected = expected
    err.limit = limit
    callback(err)
    stream.resume() // dump stream
    cleanup()
    return
  }

  var received = 0
  var buffers = []

  stream.on('data', onData)
  stream.once('end', onEnd)
  stream.once('error', callback)
  stream.once('error', cleanup)
  stream.once('close', cleanup)

  function onData(chunk) {
    buffers.push(chunk)
    received += chunk.length

    if (limit !== null && received > limit) {
      var err = new Error('request entity too large')
      err.status = 413
      err.received = received
      err.limit = limit
      callback(err)
      cleanup()
    }
  }

  function onEnd() {
    if (expected !== null && received !== expected) {
      var err = new Error('request size did not match content length')
      err.status = 400
      err.received = received
      err.expected = expected
      callback(err)
    } else {
      callback(null, Buffer.concat(buffers))
    }

    cleanup()
  }

  function cleanup() {
    received = buffers = null

    stream.removeListener('data', onData)
    stream.removeListener('end', onEnd)
    stream.removeListener('error', callback)
    stream.removeListener('error', cleanup)
    stream.removeListener('close', cleanup)
  }
}