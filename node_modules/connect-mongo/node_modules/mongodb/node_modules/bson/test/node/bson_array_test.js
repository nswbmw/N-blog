var mongodb = require('../../lib/bson').pure();

var testCase = require('nodeunit').testCase,
  mongoO = require('../../lib/bson').pure(),
  debug = require('util').debug,
  inspect = require('util').inspect,
  Buffer = require('buffer').Buffer,
  gleak = require('../../tools/gleak'),
  fs = require('fs'),
  BSON = mongoO.BSON,
  Code = mongoO.Code, 
  Binary = mongoO.Binary,
  Timestamp = mongoO.Timestamp,
  Long = mongoO.Long,
  MongoReply = mongoO.MongoReply,
  ObjectID = mongoO.ObjectID,
  Symbol = mongoO.Symbol,
  DBRef = mongoO.DBRef,
  Double = mongoO.Double,
  MinKey = mongoO.MinKey,
  MaxKey = mongoO.MaxKey,
  BinaryParser = mongoO.BinaryParser,
  utils = require('./tools/utils');

var BSONSE = mongodb,
  BSONDE = mongodb;

// for tests
BSONDE.BSON_BINARY_SUBTYPE_DEFAULT = 0;
BSONDE.BSON_BINARY_SUBTYPE_FUNCTION = 1;
BSONDE.BSON_BINARY_SUBTYPE_BYTE_ARRAY = 2;
BSONDE.BSON_BINARY_SUBTYPE_UUID = 3;
BSONDE.BSON_BINARY_SUBTYPE_MD5 = 4;
BSONDE.BSON_BINARY_SUBTYPE_USER_DEFINED = 128;          

BSONSE.BSON_BINARY_SUBTYPE_DEFAULT = 0;
BSONSE.BSON_BINARY_SUBTYPE_FUNCTION = 1;
BSONSE.BSON_BINARY_SUBTYPE_BYTE_ARRAY = 2;
BSONSE.BSON_BINARY_SUBTYPE_UUID = 3;
BSONSE.BSON_BINARY_SUBTYPE_MD5 = 4;
BSONSE.BSON_BINARY_SUBTYPE_USER_DEFINED = 128;          

var hexStringToBinary = function(string) {
  var numberofValues = string.length / 2;
  var array = "";
  
  for(var i = 0; i < numberofValues; i++) {
    array += String.fromCharCode(parseInt(string[i*2] + string[i*2 + 1], 16));
  }  
  return array;
}

var assertBuffersEqual = function(test, buffer1, buffer2) {  
  if(buffer1.length != buffer2.length) test.fail("Buffers do not have the same length", buffer1, buffer2);
  
  for(var i = 0; i < buffer1.length; i++) {
    test.equal(buffer1[i], buffer2[i]);
  }
}

/**
 * Module for parsing an ISO 8601 formatted string into a Date object.
 */
var ISODate = function (string) {
  var match;

 if (typeof string.getTime === "function")
   return string;
 else if (match = string.match(/^(\d{4})(-(\d{2})(-(\d{2})(T(\d{2}):(\d{2})(:(\d{2})(\.(\d+))?)?(Z|((\+|-)(\d{2}):(\d{2}))))?)?)?$/)) {
   var date = new Date();
   date.setUTCFullYear(Number(match[1]));
   date.setUTCMonth(Number(match[3]) - 1 || 0);
   date.setUTCDate(Number(match[5]) || 0);
   date.setUTCHours(Number(match[7]) || 0);
   date.setUTCMinutes(Number(match[8]) || 0);
   date.setUTCSeconds(Number(match[10]) || 0);
   date.setUTCMilliseconds(Number("." + match[12]) * 1000 || 0);

   if (match[13] && match[13] !== "Z") {
     var h = Number(match[16]) || 0,
         m = Number(match[17]) || 0;

     h *= 3600000;
     m *= 60000;

     var offset = h + m;
     if (match[15] == "+")
       offset = -offset;

     date = new Date(date.valueOf() + offset);
   }

   return date;
 } else
   throw new Error("Invalid ISO 8601 date given.", __filename);
};

var _Uint8Array = null;

/**
 * Retrieve the server information for the current
 * instance of the db client
 * 
 * @ignore
 */
exports.setUp = function(callback) {
  _Uint8Array = global.Uint8Array;
  delete global['Uint8Array'];
  callback();
}

/**
 * Retrieve the server information for the current
 * instance of the db client
 * 
 * @ignore
 */
exports.tearDown = function(callback) {
  global['Uint8Array'] = _Uint8Array;
  callback();
}

// /**
//  * @ignore
//  */  
// exports.shouldCorrectlyDeserializeUsingTypedArray = function(test) {
//   var motherOfAllDocuments = {
//     'string': '客家话',
//     'array': [1,2,3],
//     'hash': {'a':1, 'b':2},
//     'date': new Date(),
//     'oid': new ObjectID(),
//     'binary': new Binary(new Buffer("hello")),
//     'int': 42,
//     'float': 33.3333,
//     'regexp': /regexp/,
//     'boolean': true,
//     'long': Long.fromNumber(100),
//     'where': new Code('this.a > i', {i:1}),        
//     'dbref': new DBRef('namespace', new ObjectID(), 'integration_tests_'),
//     'minkey': new MinKey(),
//     'maxkey': new MaxKey()    
//   }
//   
//   // Let's serialize it
//   var data = BSONSE.BSON.serialize(motherOfAllDocuments, true, true, false);
//   // Build a typed array
//   var arr = new Uint8Array(new ArrayBuffer(data.length));
//   // Iterate over all the fields and copy
//   for(var i = 0; i < data.length; i++) {
//     arr[i] = data[i]
//   }
//   
//   // Deserialize the object
//   var object = BSONDE.BSON.deserialize(arr);
//   // Asserts
//   test.equal(motherOfAllDocuments.string, object.string);
//   test.deepEqual(motherOfAllDocuments.array, object.array);
//   test.deepEqual(motherOfAllDocuments.date, object.date);
//   test.deepEqual(motherOfAllDocuments.oid.toHexString(), object.oid.toHexString());
//   test.deepEqual(motherOfAllDocuments.binary.length(), object.binary.length());
//   // Assert the values of the binary
//   for(var i = 0; i < motherOfAllDocuments.binary.length(); i++) {
//     test.equal(motherOfAllDocuments.binary.value[i], object.binary[i]);
//   }
//   test.deepEqual(motherOfAllDocuments.int, object.int);
//   test.deepEqual(motherOfAllDocuments.float, object.float);
//   test.deepEqual(motherOfAllDocuments.regexp, object.regexp);
//   test.deepEqual(motherOfAllDocuments.boolean, object.boolean);
//   test.deepEqual(motherOfAllDocuments.long.toNumber(), object.long);
//   test.deepEqual(motherOfAllDocuments.where, object.where);
//   test.deepEqual(motherOfAllDocuments.dbref.oid.toHexString(), object.dbref.oid.toHexString());
//   test.deepEqual(motherOfAllDocuments.dbref.namespace, object.dbref.namespace);
//   test.deepEqual(motherOfAllDocuments.dbref.db, object.dbref.db);
//   test.deepEqual(motherOfAllDocuments.minkey, object.minkey);
//   test.deepEqual(motherOfAllDocuments.maxkey, object.maxkey);
//   test.done();
// }

/**
 * @ignore
 */  
exports.shouldCorrectlySerializeUsingTypedArray = function(test) {
  var motherOfAllDocuments = {
    'string': 'hello',
    'array': [1,2,3],
    'hash': {'a':1, 'b':2},
    'date': new Date(),
    'oid': new ObjectID(),
    'binary': new Binary(new Buffer("hello")),
    'int': 42,
    'float': 33.3333,
    'regexp': /regexp/,
    'boolean': true,
    'long': Long.fromNumber(100),
    'where': new Code('this.a > i', {i:1}),        
    'dbref': new DBRef('namespace', new ObjectID(), 'integration_tests_'),
    'minkey': new MinKey(),
    'maxkey': new MaxKey()    
  }
  
  // Let's serialize it
  var data = BSONSE.BSON.serialize(motherOfAllDocuments, true, false, false);
  // And deserialize it again
  var object = BSONSE.BSON.deserialize(data);
  // Asserts
  test.equal(motherOfAllDocuments.string, object.string);
  test.deepEqual(motherOfAllDocuments.array, object.array);
  test.deepEqual(motherOfAllDocuments.date, object.date);
  test.deepEqual(motherOfAllDocuments.oid.toHexString(), object.oid.toHexString());
  test.deepEqual(motherOfAllDocuments.binary.length(), object.binary.length());
  // Assert the values of the binary
  for(var i = 0; i < motherOfAllDocuments.binary.length(); i++) {
    test.equal(motherOfAllDocuments.binary.value[i], object.binary[i]);
  }
  test.deepEqual(motherOfAllDocuments.int, object.int);
  test.deepEqual(motherOfAllDocuments.float, object.float);
  test.deepEqual(motherOfAllDocuments.regexp, object.regexp);
  test.deepEqual(motherOfAllDocuments.boolean, object.boolean);
  test.deepEqual(motherOfAllDocuments.long.toNumber(), object.long);
  test.deepEqual(motherOfAllDocuments.where, object.where);
  test.deepEqual(motherOfAllDocuments.dbref.oid.toHexString(), object.dbref.oid.toHexString());
  test.deepEqual(motherOfAllDocuments.dbref.namespace, object.dbref.namespace);
  test.deepEqual(motherOfAllDocuments.dbref.db, object.dbref.db);
  test.deepEqual(motherOfAllDocuments.minkey, object.minkey);
  test.deepEqual(motherOfAllDocuments.maxkey, object.maxkey);
  test.done();
}

/**
 * Retrieve the server information for the current
 * instance of the db client
 * 
 * @ignore
 */
exports.noGlobalsLeaked = function(test) {
  var leaks = gleak.detectNew();
  test.equal(0, leaks.length, "global var leak detected: " + leaks.join(', '));
  test.done();
}