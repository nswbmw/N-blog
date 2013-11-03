# Raw Body [![Build Status](https://travis-ci.org/stream-utils/raw-body.png)](https://travis-ci.org/stream-utils/raw-body)

Gets the entire buffer of a stream and validates its length against an expected length and limit.
Ideal for parsing request bodies.

This is the callback version of [cat-stream](https://github.com/jonathanong/cat-stream), which is much more convoluted because streams suck.

## API

```js
var getRawBody = require('raw-body')

app.use(function (req, res, next) {
  getRawBody(req, {
    expected: req.headers['content-length'],
    limit: 1 * 1024 * 1024 // 1 mb
  }, function (err, buffer) {
    if (err)
      return next(err)

    req.rawBody = buffer
    next()
  })
})
```

### Options

- `expected` - The expected length of the stream.
  If the contents of the stream do not add up to this length,
  an `400` error code is returned.
- `limit` - The byte limit of the body.
  If the body ends up being larger than this limit,
  a `413` error code is returned.

### Strings

This library only returns the raw buffer.
If you want the string,
you can do something like this:

```js
getRawBody(req, function (err, buffer) {
  if (err)
    return next(err)

  req.text = buffer.toString('utf8')
  next()
})
```

## License

The MIT License (MIT)

Copyright (c) 2013 Jonathan Ong me@jongleberry.com

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.