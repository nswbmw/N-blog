_should_ is an expressive, readable, test framework agnostic, assertion library for [node](http://nodejs.org).

It extends the Object prototype with a single non-enumerable getter that allows you to express how that object should behave.

_should_ literally extends node's _assert_ module, for example `should.equal(str, 'foo')` will work, just as `assert.equal(str, 'foo')` would, and `should.AssertionError` **is** `assert.AssertionError`, meaning any test framework supporting this constructor will function properly with _should_.

## Example
```javascript
var user = {
    name: 'tj'
  , pets: ['tobi', 'loki', 'jane', 'bandit']
};

user.should.have.property('name', 'tj');
user.should.have.property('pets').with.lengthOf(4);

// or without Object.prototype, for guys how did Object.create(null)

should(user).have.property('name', 'tj');

someAsyncTask(foo, function(err, result){
  should.not.exist(err);
  should.exist(result);
  result.bar.should.equal(foo);
});
```
## Installation

    $ npm install should

## assert extras

As mentioned above, _should_ extends node's _assert_. The returned object from `require('should')` is thus similar to the returned object from `require('assert')`, but it has one extra convenience method:
```javascript
should.exist('hello')
should.exist([])
should.exist(null)  // will throw
```
This is equivalent to `should.ok`, which is equivalent to `assert.ok`, but reads a bit better. It gets better, though:
```javascript
should.not.exist(false)
should.not.exist('')
should.not.exist({})    // will throw
```
We may add more _assert_ extras in the future... ;)

## chaining assertions

Some assertions can be chained, for example if a property is volatile we can first assert property existence:
```javascript
user.should.have.property('pets').with.lengthOf(4)
```
which is essentially equivalent to below, however the property may not exist:
```javascript
user.pets.should.have.lengthOf(4)
```
our dummy getters such as _and_ also help express chaining:
```javascript
user.should.be.a('object').and.have.property('name', 'tj')
```
## exist (static)

The returned object from `require('should')` is the same object as `require('assert')`. So you can use `should` just like `assert`:
```javascript
should.fail('expected an error!')
should.strictEqual(foo, bar)
```
In general, using the Object prototype's _should_ is nicer than using these `assert` equivalents, because _should_ gives you access to the expressive and readable language described above:
```javascript
foo.should.equal(bar)   // same as should.strictEqual(foo, bar) above
```
The only exception, though, is when you can't be sure that a particular object exists. In that case, attempting to access the _should_ property may throw a TypeError:
```javascript
foo.should.equal(bar)   // throws if foo is null or undefined!
```
For this case, `require('should')` extends `require('assert')` with an extra convenience method to check whether an object exists:
```javascript
should.exist({})
should.exist([])
should.exist('')
should.exist(0)
should.exist(null)      // will throw
should.exist(undefined) // will throw
```
You can also check the negation:
```javascript
should.not.exist(undefined)
should.not.exist(null)
should.not.exist('')    // will throw
should.not.exist({})    // will throw
```
Once you know an object exists, you can safely use the _should_ property on it.

## ok

Assert truthfulness:
```javascript
true.should.be.ok
'yay'.should.be.ok
(1).should.be.ok
```
or negated:
```javascript
false.should.not.be.ok
''.should.not.be.ok
(0).should.not.be.ok
```
## true

Assert === true:
```javascript
true.should.be.true
'1'.should.not.be.true
```
## false

Assert === false:
```javascript
false.should.be.false
(0).should.not.be.false
```
## arguments

Assert `Arguments`:
```javascript
var args = (function(){ return arguments; })(1,2,3);
args.should.be.arguments;
[].should.not.be.arguments;
```
## empty

Asserts that length is 0:
```javascript
[].should.be.empty
''.should.be.empty
({ length: 0 }).should.be.empty
```
## eql

equality:
```javascript
({ foo: 'bar' }).should.eql({ foo: 'bar' })
[1,2,3].should.eql([1,2,3])
```
## equal

strict equality:
```javascript
should.strictEqual(undefined, value)
should.strictEqual(false, value)
(4).should.equal(4)
'test'.should.equal('test')
[1,2,3].should.not.equal([1,2,3])
```
## within

Assert inclusive numeric range:
```javascript
user.age.should.be.within(5, 50)
```
## approximately

Assert floating point number:
```javascript
(99.99).should.be.approximately(100, 0.1);
```
## a

Assert __typeof__:
```javascript
user.should.be.a('object')
'test'.should.be.a('string')
```
## instanceof and instanceOf

Assert __instanceof__ or __instanceOf__:
```javascript
user.should.be.an.instanceof(User)
[].should.be.an.instanceOf(Array)
```
## above

Assert numeric value above the given value:
```javascript
user.age.should.be.above(5)
user.age.should.not.be.above(100)
```
## below

Assert numeric value below the given value:
```javascript
user.age.should.be.below(100)
user.age.should.not.be.below(5)
```
## match

Assert regexp match:
```javascript
username.should.match(/^\w+$/)
```
## length

Assert _length_ property exists and has a value of the given number:
```javascript
user.pets.should.have.length(5)
user.pets.should.have.a.lengthOf(5)
```
Aliases: _lengthOf_

## property

Assert property exists and has optional value:
```javascript
user.should.have.property('name')
user.should.have.property('age', 15)
user.should.not.have.property('rawr')
user.should.not.have.property('age', 0)
```
## ownProperty

Assert own property (on the immediate object):
```javascript
({ foo: 'bar' }).should.have.ownProperty('foo')
```
## status(code)

 Asserts that `.statusCode` is `code`:
```javascript
res.should.have.status(200);
```
## header(field[, value])

 Asserts that a `.headers` object with `field` and optional `value` are present:
```javascript
res.should.have.header('content-length');
res.should.have.header('Content-Length', '123');
res.should.have.header('content-length', '123');
```
## json

  Assert that Content-Type is "application/json; charset=utf-8"
```javascript
res.should.be.json
```
## html

  Assert that Content-Type is "text/html; charset=utf-8"
```javascript
res.should.be.html
```

## include(obj)

Assert that the given `obj` is present via `indexOf()`, so this works for strings, arrays, or custom objects implementing indexOf.

Assert array value:
```javascript
[1,2,3].should.include(3)
[1,2,3].should.include(2)
[1,2,3].should.not.include(4)
```
Assert substring:
```javascript
'foo bar baz'.should.include('foo')
'foo bar baz'.should.include('bar')
'foo bar baz'.should.include('baz')
'foo bar baz'.should.not.include('FOO')
```
Assert object includes another object:
```javascript
var tobi = { name: 'Tobi', age: 1 };
var jane = { name: 'Jane', age: 5 };
var user = { name: 'TJ', pet: tobi };

user.should.include({ pet: tobi });
user.should.include({ pet: tobi, name: 'TJ' });
user.should.not.include({ pet: jane });
user.should.not.include({ name: 'Someone' });
```
## includeEql(obj)

Assert that an object equal to the given `obj` is present in an Array:
```javascript
[[1],[2],[3]].should.includeEql([3])
[[1],[2],[3]].should.includeEql([2])
[[1],[2],[3]].should.not.includeEql([4])
```
## throw()

Assert an exception is thrown:

```js
(function(){
  throw new Error('fail');
}).should.throw();
```

Assert an exception is not thrown:

```js
(function(){

}).should.not.throw();
```
Assert exepection message matches string:

```js
(function(){
  throw new Error('fail');
}).should.throw('fail');
```

Assert exepection message matches regexp:

```js
(function(){
  throw new Error('failed to foo');
}).should.throw(/^fail/);
```

## throwError()

An alias of `throw`, its purpose is to be an option for those who run
[jshint](https://github.com/jshint/node-jshint/) in strict mode.

```js
(function(){
  throw new Error('failed to baz');
}).should.throwError(/^fail.*/);
```

## startWith(str)

Assert that string starts with `str`.

```javascript
'foobar'.should.startWith('foo')
'foobar'.should.not.startWith('bar')
```
## endWith(str)

Assert that string ends with `str`.

```javascript
'foobar'.should.endWith('bar')
'foobar'.should.not.endWith('foo')
```

## keys

Assert own object keys, which must match _exactly_,
and will fail if you omit a key or two:

    var obj = { foo: 'bar', baz: 'raz' };
    obj.should.have.keys('foo', 'baz');
    obj.should.have.keys(['foo', 'baz']);

## Optional Error description

As it can often be difficult to ascertain exactly where failed assertions are coming from in your tests, an optional description parameter can be passed to several should matchers. The description will follow the failed assertion in the error:

    (1).should.eql(0, 'some useful description')

    AssertionError: expected 1 to equal 0 | some useful description
      at Object.eql (/Users/swift/code/should.js/node_modules/should/lib/should.js:280:10)
      ...

The methods that support this optional description are: `eql`, `equal`, `within`, `a`, `instanceof`, `above`, `below`, `match`, `length`, `property`, `ownProperty`, `include`, and `includeEql`.

## Express example

For example you can use should with the [Expresso TDD Framework](http://github.com/visionmedia/expresso) by simply including it:

    var lib = require('mylib')
      , should = require('should');

    module.exports = {
      'test .version': function(){
        lib.version.should.match(/^\d+\.\d+\.\d+$/);
      }
    };

## Running tests

To run the tests for _should_ simply update your git submodules and run:

    $ make test

## OMG IT EXTENDS OBJECT???!?!@

Yes, yes it does, with a single getter _should_, and no it won't break your code, because it does this **properly** with a non-enumerable property.

## License

(The MIT License)

Copyright (c) 2010-2011 TJ Holowaychuk &lt;tj@vision-media.ca&gt;
Copyright (c) 2011 Aseem Kishore &lt;aseem.kishore@gmail.com&gt;

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
