
1.3.0 / 2013-09-13 
==================

 * fix doc for .keys. Closes #108.
 * add #endWith()
 * add .startWith (#119)

1.2.2 / 2013-02-19 
==================

  * fix should.be.instanceOf() failure on Date

1.2.1 / 2012-11-02 
==================

  * add .showDiff
  * Make instanceOf and throwError be aliased like others [alFReD-NSH]
  * Fix should[.not].exist not having stack trace #84 [alFReD-NSH]

1.2.0 / 2012-09-21 
==================

  * Added #approximately(value, delta, description) for doing assertions on results of operations with numbers. [titarenko]

1.1.1 / 2012-09-19 
==================

  * add .type for eql()s assert

1.1.0 / 2012-07-30 
==================

  * add enclosing of failure message functions. Closes #81
  * add mocha .actual / .expected string support for all assertion values

0.7.0 / 2012-07-17 
==================

  * add `.throw(Constructor)` support [snakamura]

0.6.3 / 2012-04-26 
==================

  * Added object inclusion support back

0.6.2 / 2012-04-26 
==================

  * Added homepage to package.json
  * Fixed .equal() with dates. Closes #63

0.6.1 / 2012-04-10 
==================

  * package: add "repository" section [TooTallNate]
  * use valueOf() to get the reference the object [TooTallNate]

0.6.0 / 2012-03-01 
==================

  * Added `err.actual` and `err.expected` for .{eql,equal}()
  * Added 'return this;' to 'get json' and 'get html' in order to provide chaining for should.be.json and should.be.html

0.5.1 / 2012-01-13 
==================

  * Added better `.json`
  * Added better `.html`

0.5.0 / 2012-01-12 
==================

  * Added string matching to `.throw()` [serby]
  * Added regexp matching to `.throw()` [serby]
  * Added `.includeEql()` [RubenVerborgh]
  * Added `.should.be.html`
  * Added `.should.be.json`
  * Added optional description args to most matchers [Mike Swift]

0.4.2 / 2011-12-17 
==================

  * Fixed .header() for realzzz

0.4.1 / 2011-12-16 
==================

  * Fixed: chain .header() to retain negation

0.4.0 / 2011-12-16 
==================

  * Added `.should.throw()`
  * Added `.include()` support for strings
  * Added `.include()` support for arrays
  * Removed `keys()` `.include` modifier support
  * Removed `.object()`
  * Removed `.string()`
  * Removed `.contain()`
  * Removed `.respondTo()` rubyism
  * expresso -> mocha

0.3.2 / 2011-10-24 
==================

  * Fixed tests for 0.5.x
  * Fixed sys warning

0.3.1 / 2011-08-22 
==================

  * configurable

0.3.0 / 2011-08-20 
==================

  * Added assertion for inclusion of an object: `foo.should.include.object({ foo: 'bar' })`

0.2.1 / 2011-05-13 
==================

  * Fixed .status(code). Closes #18

0.2.0 / 2011-04-17 
==================

  * Added `res.should.have.status(code)` method
  * Added `res.should.have.header(field, val)` method

0.1.0 / 2011-04-06 
==================

  * Added `should.exist(obj)` [aseemk]
  * Added `should.not.exist(obj)` [aseemk]

0.0.4 / 2010-11-24 
==================

  * Added `.ok` to assert truthfulness
  * Added `.arguments`
  * Fixed double required bug. [thanks dominictarr]

0.0.3 / 2010-11-19 
==================

  * Added `true` / `false` assertions

0.0.2 / 2010-11-19 
==================

  * Added chaining support

0.0.1 / 2010-11-19 
==================

  * Initial release
