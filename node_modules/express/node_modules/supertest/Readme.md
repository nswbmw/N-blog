# SuperTest

  HTTP assertions made easy via [super-agent](http://github.com/visionmedia/superagent).

## About

  The motivation with this module is to provide a high-level abstraction for testing
  HTTP, while still allowing you to drop down to the lower-level API provided by super-agent.

## Example

  You may pass an `http.Server`, or a `Function` to `request()` - if the server is not
  already listening for connections then it is bound to an ephemeral port for you so
  there is no need to keep track of ports.

  SuperTest works with any test framework, here is an example without using any
  test framework at all:

```js
var request = require('supertest')
  , express = require('express');

var app = express();

app.get('/user', function(req, res){
  res.send(201, { name: 'tobi' });
});

request(app)
  .get('/user')
  .expect('Content-Type', /json/)
  .expect('Content-Length', '20')
  .expect(201)
  .end(function(err, res){
    if (err) throw err;
  });
```

  Here's an example with mocha, note how you can pass `done` straight to any of the `.expect()` calls:

```js
describe('GET /users', function(){
  it('respond with json', function(done){
    request(app)
      .get('/user')
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200, done);
  })
})
```

  If you are using the `.end()` method `.expect()` assertions that fail will
  not throw - they will return the assertion as an error to the `.end()` callback. In
  order to fail the test case, you will need to rethrow or pass `err` to `done()`, as follows:

```js
describe('GET /users', function(){
  it('respond with json', function(done){
    request(app)
      .get('/user')
      .set('Accept', 'application/json')
      .expect(200)
      .end(function(err, res){
        if (err) return done(err);
        done()
      });
  })
})
```

  Anything you can do with superagent, you can do with supertest - for example multipart file uploads!

```js
request(app)
.post('/')
.attach('avatar', 'test/fixtures/homeboy.jpg')
...
```

  Passing the app or url each time is not necessary, if you're testing
  the same host you may simply re-assign the request variable with the
  initialization app or url, a new `Test` is created per `request.VERB()` call.

```js
request = request('http://localhost:5555');

request.get('/').expect(200, function(err){
  console.log(err);
});

request.get('/').expect('heya', function(err){
  console.log(err);
});
```

## API

  You may use any [super-agent](http://github.com/visionmedia/superagent) methods,
  including `.write()`, `.pipe()` etc and perform assertions in the `.end()` callback
  for lower-level needs.

### .expect(status[, fn])

  Assert response `status` code.

### .expect(status, body[, fn])

  Assert response `status` code and `body`.

### .expect(body[, fn])

  Assert response `body` text with a string, regular expression, or
  parsed body object.

### .expect(field, value[, fn])

  Assert header `field` `value` with a string or regular expression.

### .end(fn)

  Perform the request and invoke `fn(err, res)`.

## Notes

  Inspired by [api-easy](https://github.com/flatiron/api-easy) minus vows coupling.

## License

  MIT
