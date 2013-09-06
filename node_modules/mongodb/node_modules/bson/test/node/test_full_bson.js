var sys = require('util'),
  fs = require('fs'),
  BSON = require('../../ext').BSON,
  Buffer = require('buffer').Buffer,
  BSONJS = require('../../lib/bson/bson').BSON,
  BinaryParser = require('../../lib/bson/binary_parser').BinaryParser,
  Long = require('../../lib/bson/long').Long,
  ObjectID = require('../../lib/bson/bson').ObjectID,
  Binary = require('../../lib/bson/bson').Binary,
  Code = require('../../lib/bson/bson').Code,
  DBRef = require('../../lib/bson/bson').DBRef,
  Symbol = require('../../lib/bson/bson').Symbol,
  Double = require('../../lib/bson/bson').Double,
  MaxKey = require('../../lib/bson/bson').MaxKey,
  MinKey = require('../../lib/bson/bson').MinKey,
  Timestamp = require('../../lib/bson/bson').Timestamp,
  gleak = require('../../tools/gleak'),
  assert = require('assert');

// Parsers
var bsonC = new BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]);
var bsonJS = new BSONJS([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]);

/**
 * Retrieve the server information for the current
 * instance of the db client
 *
 * @ignore
 */
exports.setUp = function(callback) {
  callback();
}

/**
 * Retrieve the server information for the current
 * instance of the db client
 *
 * @ignore
 */
exports.tearDown = function(callback) {
  callback();
}

/**
 * @ignore
 */
exports['Should Correctly Deserialize object'] = function(test) {
  var bytes = [95,0,0,0,2,110,115,0,42,0,0,0,105,110,116,101,103,114,97,116,105,111,110,95,116,101,115,116,115,95,46,116,101,115,116,95,105,110,100,101,120,95,105,110,102,111,114,109,97,116,105,111,110,0,8,117,110,105,113,117,101,0,0,3,107,101,121,0,12,0,0,0,16,97,0,1,0,0,0,0,2,110,97,109,101,0,4,0,0,0,97,95,49,0,0];
  var serialized_data = '';
  // Convert to chars
  for(var i = 0; i < bytes.length; i++) {
    serialized_data = serialized_data + BinaryParser.fromByte(bytes[i]);
  }

  var object = bsonC.deserialize(serialized_data);
  assert.equal("a_1", object.name);
  assert.equal(false, object.unique);
  assert.equal(1, object.key.a);
  test.done();
}

/**
 * @ignore
 */
exports['Should Correctly Deserialize object with all types'] = function(test) {
  var bytes = [26,1,0,0,7,95,105,100,0,161,190,98,75,118,169,3,0,0,3,0,0,4,97,114,114,97,121,0,26,0,0,0,16,48,0,1,0,0,0,16,49,0,2,0,0,0,16,50,0,3,0,0,0,0,2,115,116,114,105,110,103,0,6,0,0,0,104,101,108,108,111,0,3,104,97,115,104,0,19,0,0,0,16,97,0,1,0,0,0,16,98,0,2,0,0,0,0,9,100,97,116,101,0,161,190,98,75,0,0,0,0,7,111,105,100,0,161,190,98,75,90,217,18,0,0,1,0,0,5,98,105,110,97,114,121,0,7,0,0,0,2,3,0,0,0,49,50,51,16,105,110,116,0,42,0,0,0,1,102,108,111,97,116,0,223,224,11,147,169,170,64,64,11,114,101,103,101,120,112,0,102,111,111,98,97,114,0,105,0,8,98,111,111,108,101,97,110,0,1,15,119,104,101,114,101,0,25,0,0,0,12,0,0,0,116,104,105,115,46,120,32,61,61,32,51,0,5,0,0,0,0,3,100,98,114,101,102,0,37,0,0,0,2,36,114,101,102,0,5,0,0,0,116,101,115,116,0,7,36,105,100,0,161,190,98,75,2,180,1,0,0,2,0,0,0,10,110,117,108,108,0,0];
  var serialized_data = '';
  // Convert to chars
  for(var i = 0; i < bytes.length; i++) {
    serialized_data = serialized_data + BinaryParser.fromByte(bytes[i]);
  }

  var object = bsonJS.deserialize(new Buffer(serialized_data, 'binary'));
  assert.equal("hello", object.string);
  assert.deepEqual([1, 2, 3], object.array);
  assert.equal(1, object.hash.a);
  assert.equal(2, object.hash.b);
  assert.ok(object.date != null);
  assert.ok(object.oid != null);
  assert.ok(object.binary != null);
  assert.equal(42, object.int);
  assert.equal(33.3333, object.float);
  assert.ok(object.regexp != null);
  assert.equal(true, object.boolean);
  assert.ok(object.where != null);
  assert.ok(object.dbref != null);
  assert.ok(object['null'] == null);
  test.done();
}

/**
 * @ignore
 */
exports['Should Serialize and Deserialize String'] = function(test) {
  var test_string = {hello: 'world'}
  var serialized_data = bsonC.serialize(test_string)
  assert.deepEqual(test_string, bsonC.deserialize(serialized_data));
  test.done();
}

/**
 * @ignore
 */
exports['Should Correctly Serialize and Deserialize Integer'] = function(test) {
  var test_number = {doc: 5}
  var serialized_data = bsonC.serialize(test_number)
  assert.deepEqual(test_number, bsonC.deserialize(serialized_data));
  test.done();
}

/**
 * @ignore
 */
exports['Should Correctly Serialize and Deserialize null value'] = function(test) {
  var test_null = {doc:null}
  var serialized_data = bsonC.serialize(test_null)
  var object = bsonC.deserialize(serialized_data);
  assert.deepEqual(test_null, object);
  test.done();
}

/**
 * @ignore
 */
exports['Should Correctly Serialize and Deserialize undefined value'] = function(test) {
  var test_undefined = {doc:undefined}
  var serialized_data = bsonC.serialize(test_undefined)
  var object = bsonJS.deserialize(new Buffer(serialized_data, 'binary'));
  assert.equal(null, object.doc)
  test.done();
}

/**
 * @ignore
 */
exports['Should Correctly Serialize and Deserialize Number'] = function(test) {
  var test_number = {doc: 5.5}
  var serialized_data = bsonC.serialize(test_number)
  assert.deepEqual(test_number, bsonC.deserialize(serialized_data));
  test.done();
}

/**
 * @ignore
 */
exports['Should Correctly Serialize and Deserialize Integer'] = function(test) {
  var test_int = {doc: 42}
  var serialized_data = bsonC.serialize(test_int)
  assert.deepEqual(test_int, bsonC.deserialize(serialized_data));

  test_int = {doc: -5600}
  serialized_data = bsonC.serialize(test_int)
  assert.deepEqual(test_int, bsonC.deserialize(serialized_data));

  test_int = {doc: 2147483647}
  serialized_data = bsonC.serialize(test_int)
  assert.deepEqual(test_int, bsonC.deserialize(serialized_data));

  test_int = {doc: -2147483648}
  serialized_data = bsonC.serialize(test_int)
  assert.deepEqual(test_int, bsonC.deserialize(serialized_data));
  test.done();
}

/**
 * @ignore
 */
exports['Should Correctly Serialize and Deserialize Object'] = function(test) {
  var doc = {doc: {age: 42, name: 'Spongebob', shoe_size: 9.5}}
  var serialized_data = bsonC.serialize(doc)
  assert.deepEqual(doc, bsonC.deserialize(serialized_data));
  test.done();
}

/**
 * @ignore
 */
exports['Should Correctly Serialize and Deserialize Array'] = function(test) {
  var doc = {doc: [1, 2, 'a', 'b']}
  var serialized_data = bsonC.serialize(doc)
  assert.deepEqual(doc, bsonC.deserialize(serialized_data));
  test.done();
}

/**
 * @ignore
 */
exports['Should Correctly Serialize and Deserialize Array with added on functions'] = function(test) {
  var doc = {doc: [1, 2, 'a', 'b']}
  var serialized_data = bsonC.serialize(doc)
  assert.deepEqual(doc, bsonC.deserialize(serialized_data));
  test.done();
}

/**
 * @ignore
 */
exports['Should Correctly Serialize and Deserialize A Boolean'] = function(test) {
  var doc = {doc: true}
  var serialized_data = bsonC.serialize(doc)
  assert.deepEqual(doc, bsonC.deserialize(serialized_data));
  test.done();
}

/**
 * @ignore
 */
exports['Should Correctly Serialize and Deserialize a Date'] = function(test) {
  var date = new Date()
  //(2009, 11, 12, 12, 00, 30)
  date.setUTCDate(12)
  date.setUTCFullYear(2009)
  date.setUTCMonth(11 - 1)
  date.setUTCHours(12)
  date.setUTCMinutes(0)
  date.setUTCSeconds(30)
  var doc = {doc: date}
  var serialized_data = bsonC.serialize(doc)
  assert.deepEqual(doc, bsonC.deserialize(serialized_data));
  test.done();
}

/**
 * @ignore
 */
exports['Should Correctly Serialize and Deserialize Oid'] = function(test) {
  var doc = {doc: new ObjectID()}
  var serialized_data = bsonC.serialize(doc)
  assert.deepEqual(doc.doc.toHexString(), bsonC.deserialize(serialized_data).doc.toHexString())
  test.done();
}

/**
 * @ignore
 */
exports['Should Correctly Serialize and Deserialize Buffer'] = function(test) {
  var doc = {doc: new Buffer("123451234512345")}
  var serialized_data = bsonC.serialize(doc)

  assert.equal("123451234512345", bsonC.deserialize(serialized_data).doc.buffer.toString('ascii'));
  test.done();
}

/**
 * @ignore
 */
exports['Should Correctly encode Empty Hash'] = function(test) {
  var test_code = {}
  var serialized_data = bsonC.serialize(test_code)
  assert.deepEqual(test_code, bsonC.deserialize(serialized_data));
  test.done();
}

/**
 * @ignore
 */
exports['Should Correctly Serialize and Deserialize Ordered Hash'] = function(test) {
  var doc = {doc: {b:1, a:2, c:3, d:4}}
  var serialized_data = bsonC.serialize(doc)
  var decoded_hash = bsonC.deserialize(serialized_data).doc
  var keys = []
  for(var name in decoded_hash) keys.push(name)
  assert.deepEqual(['b', 'a', 'c', 'd'], keys)
  test.done();
}

/**
 * @ignore
 */
exports['Should Correctly Serialize and Deserialize Regular Expression'] = function(test) {
  var doc = {doc: /foobar/mi}
  var serialized_data = bsonC.serialize(doc)
  var doc2 = bsonC.deserialize(serialized_data);
  assert.equal(doc.doc.toString(), doc2.doc.toString())
  test.done();
}

/**
 * @ignore
 */
exports['Should Correctly Serialize and Deserialize a Binary object'] = function(test) {
  var bin = new Binary()
  var string = 'binstring'
  for(var index = 0; index < string.length; index++) {
    bin.put(string.charAt(index))
  }
  var doc = {doc: bin}
  var serialized_data = bsonC.serialize(doc)
  var deserialized_data = bsonC.deserialize(serialized_data);
  assert.equal(doc.doc.value(), deserialized_data.doc.value())
  test.done();
}

/**
 * @ignore
 */
exports['Should Correctly Serialize and Deserialize a big Binary object'] = function(test) {
  var data = fs.readFileSync("test/node/data/test_gs_weird_bug.png", 'binary');
  var bin = new Binary()
  bin.write(data)
  var doc = {doc: bin}
  var serialized_data = bsonC.serialize(doc)
  var deserialized_data = bsonC.deserialize(serialized_data);
  assert.equal(doc.doc.value(), deserialized_data.doc.value())
  test.done();
}

/**
 * @ignore
 */
exports.noGlobalsLeaked = function(test) {
  var leaks = gleak.detectNew();
  test.equal(0, leaks.length, "global var leak detected: " + leaks.join(', '));
  test.done();
}
