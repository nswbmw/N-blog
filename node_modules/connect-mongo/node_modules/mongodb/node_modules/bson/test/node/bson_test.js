var mongodb = process.env['TEST_NATIVE'] != null ? require('../../lib/bson').native() : require('../../lib/bson').pure();

var testCase = require('nodeunit').testCase,
  mongoO = require('../../lib/bson').pure(),
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
  ObjectId = mongoO.ObjectId,
  Symbol = mongoO.Symbol,
  DBRef = mongoO.DBRef,
  Double = mongoO.Double,
  MinKey = mongoO.MinKey,
  MaxKey = mongoO.MaxKey,
  BinaryParser = mongoO.BinaryParser,
  vm = require('vm');  

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
exports['Should Correctly create ObjectID and do deep equals'] = function(test) {
  var test_string = {hello: new ObjectID()};
  test_string.hello.toHexString();
  
  var serialized_data = new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serialize(test_string, false, true);
  test.deepEqual(test_string, new BSONDE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).deserialize(serialized_data));
  test.done();
}
  
/**
 * @ignore
 */
exports['Should Correctly get BSON types from require'] = function(test) {
  var _mongodb = require('../../lib/bson');
  test.ok(_mongodb.ObjectID === ObjectID);
  test.ok(_mongodb.Binary === Binary);
  test.ok(_mongodb.Long === Long);
  test.ok(_mongodb.Timestamp === Timestamp);
  test.ok(_mongodb.Code === Code);
  test.ok(_mongodb.DBRef === DBRef);
  test.ok(_mongodb.Symbol === Symbol);
  test.ok(_mongodb.MinKey === MinKey);
  test.ok(_mongodb.MaxKey === MaxKey);
  test.ok(_mongodb.Double === Double);
  test.done();
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

  var object = new BSONDE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).deserialize(new Buffer(serialized_data, 'binary'));
  test.equal("a_1", object.name);
  test.equal(false, object.unique);
  test.equal(1, object.key.a);
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

  var object = new BSONDE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).deserialize(new Buffer(serialized_data, 'binary'));//, false, true);
  // Perform tests
  test.equal("hello", object.string);
  test.deepEqual([1,2,3], object.array);
  test.equal(1, object.hash.a);
  test.equal(2, object.hash.b);
  test.ok(object.date != null);
  test.ok(object.oid != null);
  test.ok(object.binary != null);
  test.equal(42, object.int);
  test.equal(33.3333, object.float);
  test.ok(object.regexp != null);
  test.equal(true, object.boolean);
  test.ok(object.where != null);
  test.ok(object.dbref != null);
  test.ok(object[null] == null);    
  test.done();
}

/**
 * @ignore
 */
exports['Should Serialize and Deserialize String'] = function(test) {
  var test_string = {hello: 'world'};
  var serialized_data = new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serialize(test_string, false, true);
  var serialized_data2 = new Buffer(new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).calculateObjectSize(test_string));
  new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serializeWithBufferAndIndex(test_string, false, serialized_data2, 0);    

  assertBuffersEqual(test, serialized_data, serialized_data2, 0);
  test.deepEqual(test_string, new BSONDE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).deserialize(serialized_data));
  test.done();
}

/**
 * @ignore
 */
exports['Should Serialize and Deserialize Empty String'] = function(test) {
  var test_string = {hello: ''};
  var serialized_data = new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serialize(test_string, false, true);
  var serialized_data2 = new Buffer(new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).calculateObjectSize(test_string));
  new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serializeWithBufferAndIndex(test_string, false, serialized_data2, 0);    

  assertBuffersEqual(test, serialized_data, serialized_data2, 0);
  test.deepEqual(test_string, new BSONDE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).deserialize(serialized_data));
  test.done();
}

/**
 * @ignore
 */
exports['Should Correctly Serialize and Deserialize Integer'] = function(test) {    
  var test_number = {doc: 5};

  var serialized_data = new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serialize(test_number, false, true);
  var serialized_data2 = new Buffer(new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).calculateObjectSize(test_number));
  new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serializeWithBufferAndIndex(test_number, false, serialized_data2, 0);    
  assertBuffersEqual(test, serialized_data, serialized_data2, 0);      
  test.deepEqual(test_number, new BSONDE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).deserialize(serialized_data));
  test.deepEqual(test_number, new BSONDE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).deserialize(serialized_data2));
  test.done();
}

/**
 * @ignore
 */
exports['Should Correctly Serialize and Deserialize null value'] = function(test) {
  var test_null = {doc:null};
  var serialized_data = new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serialize(test_null, false, true);

  var serialized_data2 = new Buffer(new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).calculateObjectSize(test_null));
  new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serializeWithBufferAndIndex(test_null, false, serialized_data2, 0);    
  assertBuffersEqual(test, serialized_data, serialized_data2, 0);

  var object = new BSONDE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).deserialize(serialized_data);
  test.equal(null, object.doc);
  test.done();
}

/**
 * @ignore
 */
exports['Should Correctly Serialize and Deserialize Number'] = function(test) {
  var test_number = {doc: 5.5};
  var serialized_data = new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serialize(test_number, false, true);

  var serialized_data2 = new Buffer(new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).calculateObjectSize(test_number));
  new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serializeWithBufferAndIndex(test_number, false, serialized_data2, 0);    
  assertBuffersEqual(test, serialized_data, serialized_data2, 0);

  test.deepEqual(test_number, new BSONDE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).deserialize(serialized_data));
  test.done();    
}

/**
 * @ignore
 */
exports['Should Correctly Serialize and Deserialize Integer'] = function(test) {
  var test_int = {doc: 42};
  var serialized_data = new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serialize(test_int, false, true);

  var serialized_data2 = new Buffer(new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).calculateObjectSize(test_int));
  new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serializeWithBufferAndIndex(test_int, false, serialized_data2, 0);    
  assertBuffersEqual(test, serialized_data, serialized_data2, 0);
  test.deepEqual(test_int.doc, new BSONDE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).deserialize(serialized_data).doc);

  test_int = {doc: -5600};
  serialized_data = new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serialize(test_int, false, true);

  var serialized_data2 = new Buffer(new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).calculateObjectSize(test_int));
  new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serializeWithBufferAndIndex(test_int, false, serialized_data2, 0);    
  assertBuffersEqual(test, serialized_data, serialized_data2, 0);
  test.deepEqual(test_int.doc, new BSONDE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).deserialize(serialized_data).doc);

  test_int = {doc: 2147483647};
  serialized_data = new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serialize(test_int, false, true);

  var serialized_data2 = new Buffer(new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).calculateObjectSize(test_int));
  new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serializeWithBufferAndIndex(test_int, false, serialized_data2, 0);    
  assertBuffersEqual(test, serialized_data, serialized_data2, 0);
  test.deepEqual(test_int.doc, new BSONDE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).deserialize(serialized_data).doc);
      
  test_int = {doc: -2147483648};
  serialized_data = new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serialize(test_int, false, true);

  var serialized_data2 = new Buffer(new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).calculateObjectSize(test_int));
  new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serializeWithBufferAndIndex(test_int, false, serialized_data2, 0);    
  assertBuffersEqual(test, serialized_data, serialized_data2, 0);
  test.deepEqual(test_int.doc, new BSONDE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).deserialize(serialized_data).doc);
  test.done();        
}

/**
 * @ignore
 */
exports['Should Correctly Serialize and Deserialize Object'] = function(test) {
  var doc = {doc: {age: 42, name: 'Spongebob', shoe_size: 9.5}};
  var serialized_data = new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serialize(doc, false, true);

  var serialized_data2 = new Buffer(new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).calculateObjectSize(doc, false, true));
  new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serializeWithBufferAndIndex(doc, false, serialized_data2, 0);    
  assertBuffersEqual(test, serialized_data, serialized_data2, 0);

  test.deepEqual(doc.doc.age, new BSONDE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).deserialize(serialized_data).doc.age);
  test.deepEqual(doc.doc.name, new BSONDE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).deserialize(serialized_data).doc.name);
  test.deepEqual(doc.doc.shoe_size, new BSONDE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).deserialize(serialized_data).doc.shoe_size);
  test.done();        
}

/**
 * @ignore
 */
exports['Should Correctly Serialize and Deserialize Array'] = function(test) {
  var doc = {doc: [1, 2, 'a', 'b']};
  var serialized_data = new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serialize(doc, false, true);

  var serialized_data2 = new Buffer(new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).calculateObjectSize(doc, false, true));
  new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serializeWithBufferAndIndex(doc, false, serialized_data2, 0);    
  assertBuffersEqual(test, serialized_data, serialized_data2, 0);

  var deserialized = new BSONDE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).deserialize(serialized_data);  
  test.equal(doc.doc[0], deserialized.doc[0])
  test.equal(doc.doc[1], deserialized.doc[1])
  test.equal(doc.doc[2], deserialized.doc[2])
  test.equal(doc.doc[3], deserialized.doc[3])
  test.done();        
}

/**
 * @ignore
 */
exports['Should Correctly Serialize and Deserialize Array with added on functions'] = function(test) {
  Array.prototype.toXml = function() {};
  var doc = {doc: [1, 2, 'a', 'b']};
  var serialized_data = new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serialize(doc, false, true);

  var serialized_data2 = new Buffer(new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).calculateObjectSize(doc, false, true));
  new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serializeWithBufferAndIndex(doc, false, serialized_data2, 0);    
  assertBuffersEqual(test, serialized_data, serialized_data2, 0);

  var deserialized = new BSONDE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).deserialize(serialized_data);  
  test.equal(doc.doc[0], deserialized.doc[0])
  test.equal(doc.doc[1], deserialized.doc[1])
  test.equal(doc.doc[2], deserialized.doc[2])
  test.equal(doc.doc[3], deserialized.doc[3])
  test.done();        
}

/**
 * @ignore
 */
exports['Should correctly deserialize a nested object'] = function(test) {
  var doc = {doc: {doc:1}};
  var serialized_data = new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serialize(doc, false, true);

  var serialized_data2 = new Buffer(new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).calculateObjectSize(doc, false, true));
  new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serializeWithBufferAndIndex(doc, false, serialized_data2, 0);    
  assertBuffersEqual(test, serialized_data, serialized_data2, 0);

  test.deepEqual(doc.doc.doc, new BSONDE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).deserialize(serialized_data).doc.doc);
  test.done();            
}

/**
 * @ignore
 */
exports['Should Correctly Serialize and Deserialize A Boolean'] = function(test) {
  var doc = {doc: true};
  var serialized_data = new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serialize(doc, false, true);

  var serialized_data2 = new Buffer(new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).calculateObjectSize(doc, false, true));
  new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serializeWithBufferAndIndex(doc, false, serialized_data2, 0);    
  assertBuffersEqual(test, serialized_data, serialized_data2, 0);

  test.equal(doc.doc, new BSONDE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).deserialize(serialized_data).doc);    
  test.done();        
}

/**
 * @ignore
 */
exports['Should Correctly Serialize and Deserialize a Date'] = function(test) {
  var date = new Date();
  //(2009, 11, 12, 12, 00, 30)
  date.setUTCDate(12);
  date.setUTCFullYear(2009);
  date.setUTCMonth(11 - 1);
  date.setUTCHours(12);
  date.setUTCMinutes(0);
  date.setUTCSeconds(30);
  var doc = {doc: date};
  var serialized_data = new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serialize(doc, false, true);

  var serialized_data2 = new Buffer(new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).calculateObjectSize(doc, false, true));
  new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serializeWithBufferAndIndex(doc, false, serialized_data2, 0);    
  assertBuffersEqual(test, serialized_data, serialized_data2, 0);

  test.equal(doc.date, new BSONDE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).deserialize(serialized_data).doc.date);
  test.done();        
}

/**
 * @ignore
 */
exports['Should Correctly Serialize and Deserialize a Date from another VM'] = function(test) {
  var script = "date1 = new Date();",
      ctx = vm.createContext({
                date1 : null
      });
  vm.runInContext(script, ctx, 'myfile.vm');      
    
  var date = ctx.date1;
  //(2009, 11, 12, 12, 00, 30)
  date.setUTCDate(12);
  date.setUTCFullYear(2009);
  date.setUTCMonth(11 - 1);
  date.setUTCHours(12);
  date.setUTCMinutes(0);
  date.setUTCSeconds(30);
  var doc = {doc: date};
  var serialized_data = new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serialize(doc, false, true);

  var serialized_data2 = new Buffer(new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).calculateObjectSize(doc, false, true));
  new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serializeWithBufferAndIndex(doc, false, serialized_data2, 0);    
  assertBuffersEqual(test, serialized_data, serialized_data2, 0);

  test.equal(doc.date, new BSONDE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).deserialize(serialized_data).doc.date);
  test.done();        
}

/**
 * @ignore
 */
exports['Should Correctly Serialize nested doc'] = function(test) {
  var doc = {
    string: "Strings are great",
    decimal: 3.14159265,
    bool: true,
    integer: 5,

    subObject: {
      moreText: "Bacon ipsum dolor.",
      longKeylongKeylongKeylongKeylongKeylongKey: "Pork belly."
    },

    subArray: [1,2,3,4,5,6,7,8,9,10],
    anotherString: "another string"
  }

  var serialized_data = new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serialize(doc, false, true);

  var serialized_data2 = new Buffer(new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).calculateObjectSize(doc, false, true));
  new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serializeWithBufferAndIndex(doc, false, serialized_data2, 0);    
  assertBuffersEqual(test, serialized_data, serialized_data2, 0);

  test.done();
}

/**
 * @ignore
 */
exports['Should Correctly Serialize and Deserialize Oid'] = function(test) {
  var doc = {doc: new ObjectID()};
  var doc2 = {doc: ObjectID.createFromHexString(doc.doc.toHexString())};
  var serialized_data = new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serialize(doc, false, true);

  var serialized_data2 = new Buffer(new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).calculateObjectSize(doc, false, true));
  new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serializeWithBufferAndIndex(doc, false, serialized_data2, 0);
  assertBuffersEqual(test, serialized_data, serialized_data2, 0);

  test.deepEqual(doc, new BSONDE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).deserialize(serialized_data));
  test.done();
}

/**
 * @ignore
 */
exports['Should Correctly encode Empty Hash'] = function(test) {
  var doc = {};
  var serialized_data = new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serialize(doc, false, true);

  var serialized_data2 = new Buffer(new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).calculateObjectSize(doc, false, true));
  new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serializeWithBufferAndIndex(doc, false, serialized_data2, 0);    
  assertBuffersEqual(test, serialized_data, serialized_data2, 0);

  test.deepEqual(doc, new BSONDE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).deserialize(serialized_data));
  test.done();        
}

/**
 * @ignore
 */
exports['Should Correctly Serialize and Deserialize Ordered Hash'] = function(test) {
  var doc = {doc: {b:1, a:2, c:3, d:4}};
  var serialized_data = new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serialize(doc, false, true);

  var serialized_data2 = new Buffer(new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).calculateObjectSize(doc, false, true));
  new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serializeWithBufferAndIndex(doc, false, serialized_data2, 0);    
  assertBuffersEqual(test, serialized_data, serialized_data2, 0);

  var decoded_hash = new BSONDE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).deserialize(serialized_data).doc;
  var keys = [];

  for(var name in decoded_hash) keys.push(name);
  test.deepEqual(['b', 'a', 'c', 'd'], keys);
  test.done();        
}

/**
 * @ignore
 */
exports['Should Correctly Serialize and Deserialize Regular Expression'] = function(test) {
  // Serialize the regular expression
  var doc = {doc: /foobar/mi};
  var serialized_data = new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serialize(doc, false, true);

  var serialized_data2 = new Buffer(new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).calculateObjectSize(doc, false, true));
  new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serializeWithBufferAndIndex(doc, false, serialized_data2, 0);    
  assertBuffersEqual(test, serialized_data, serialized_data2, 0);  

  var doc2 = new BSONDE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).deserialize(serialized_data);

  test.deepEqual(doc.doc.toString(), doc2.doc.toString());
  test.done();        
}

/**
 * @ignore
 */
exports['Should Correctly Serialize and Deserialize a Binary object'] = function(test) {
  var bin = new Binary();
  var string = 'binstring';
  for(var index = 0; index < string.length; index++) {
    bin.put(string.charAt(index));
  }
  
  var doc = {doc: bin};
  var serialized_data = new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serialize(doc, false, true);
    
  var serialized_data2 = new Buffer(new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).calculateObjectSize(doc, false, true));
  new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serializeWithBufferAndIndex(doc, false, serialized_data2, 0);    
  assertBuffersEqual(test, serialized_data, serialized_data2, 0);
    
  var deserialized_data = new BSONDE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).deserialize(serialized_data);
  
  test.deepEqual(doc.doc.value(), deserialized_data.doc.value());
  test.done();        
}

/**
 * @ignore
 */
exports['Should Correctly Serialize and Deserialize a Type 2 Binary object'] = function(test) {
  var bin = new Binary(new Buffer('binstring'), Binary.SUBTYPE_BYTE_ARRAY);
  var string = 'binstring';
  for(var index = 0; index < string.length; index++) {
    bin.put(string.charAt(index));
  }
  
  var doc = {doc: bin};
  var serialized_data = new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serialize(doc, false, true);
    
  var serialized_data2 = new Buffer(new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).calculateObjectSize(doc, false, true));
  new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serializeWithBufferAndIndex(doc, false, serialized_data2, 0);    
  assertBuffersEqual(test, serialized_data, serialized_data2, 0);
    
  var deserialized_data = new BSONDE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).deserialize(serialized_data);
  
  test.deepEqual(doc.doc.value(), deserialized_data.doc.value());
  test.done();        
}

/**
 * @ignore
 */
exports['Should Correctly Serialize and Deserialize a big Binary object'] = function(test) {
  var data = fs.readFileSync("test/node/data/test_gs_weird_bug.png", 'binary');
  var bin = new Binary();
  bin.write(data);
  var doc = {doc: bin};
  var serialized_data = new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serialize(doc, false, true);

  var serialized_data2 = new Buffer(new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).calculateObjectSize(doc, false, true));
  new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serializeWithBufferAndIndex(doc, false, serialized_data2, 0);    
  assertBuffersEqual(test, serialized_data, serialized_data2, 0);

  var deserialized_data = new BSONDE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).deserialize(serialized_data);
  test.deepEqual(doc.doc.value(), deserialized_data.doc.value());
  test.done();        
}

/**
 * @ignore
 */
exports["Should Correctly Serialize and Deserialize DBRef"] = function(test) {
  var oid = new ObjectID();
  var doc = {dbref: new DBRef('namespace', oid, null)};
  var serialized_data = new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serialize(doc, false, true);

  var serialized_data2 = new Buffer(new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).calculateObjectSize(doc, false, true));
  new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serializeWithBufferAndIndex(doc, false, serialized_data2, 0);    
  assertBuffersEqual(test, serialized_data, serialized_data2, 0);

  var doc2 = new BSONDE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).deserialize(serialized_data);    
  test.equal("namespace", doc2.dbref.namespace);
  test.deepEqual(doc2.dbref.oid.toHexString(), oid.toHexString());
  test.done();        
}

/**
 * @ignore
 */
exports['Should Correctly Serialize and Deserialize partial DBRef'] = function(test) {
  var id = new ObjectID();
  var doc = {'name':'something', 'user':{'$ref':'username', '$id': id}};
  var serialized_data = new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serialize(doc, false, true);

  var serialized_data2 = new Buffer(new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).calculateObjectSize(doc, false, true));
  new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serializeWithBufferAndIndex(doc, false, serialized_data2, 0);    
  assertBuffersEqual(test, serialized_data, serialized_data2, 0);

  var doc2 = new BSONDE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).deserialize(serialized_data);
  test.equal('something', doc2.name);
  test.equal('username', doc2.user.namespace);
  test.equal(id.toString(), doc2.user.oid.toString());
  test.done();                
}

/**
 * @ignore
 */
exports['Should Correctly Serialize and Deserialize simple Int'] = function(test) {
  var doc = {doc:2147483648};
  var serialized_data = new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serialize(doc, false, true);

  var serialized_data2 = new Buffer(new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).calculateObjectSize(doc, false, true));
  new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serializeWithBufferAndIndex(doc, false, serialized_data2, 0);    
  assertBuffersEqual(test, serialized_data, serialized_data2, 0);

  var doc2 = new BSONDE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).deserialize(serialized_data);
  test.deepEqual(doc.doc, doc2.doc)
  test.done();
}

/**
 * @ignore
 */
exports['Should Correctly Serialize and Deserialize Long Integer'] = function(test) {
  var doc = {doc: Long.fromNumber(9223372036854775807)};
  var serialized_data = new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serialize(doc, false, true);

  var serialized_data2 = new Buffer(new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).calculateObjectSize(doc, false, true));
  new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serializeWithBufferAndIndex(doc, false, serialized_data2, 0);    
  assertBuffersEqual(test, serialized_data, serialized_data2, 0);

  var deserialized_data = new BSONDE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).deserialize(serialized_data);
  test.deepEqual(doc.doc, deserialized_data.doc);
  
  doc = {doc: Long.fromNumber(-9223372036854775)};
  serialized_data = new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serialize(doc, false, true);
  deserialized_data = new BSONDE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).deserialize(serialized_data);
  test.deepEqual(doc.doc, deserialized_data.doc);
  
  doc = {doc: Long.fromNumber(-9223372036854775809)};
  serialized_data = new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serialize(doc, false, true);
  deserialized_data = new BSONDE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).deserialize(serialized_data);
  test.deepEqual(doc.doc, deserialized_data.doc);
  test.done();        
}

/**
 * @ignore
 */
exports['Should Deserialize Large Integers as Number not Long'] = function(test) {
  function roundTrip(val) {
    var doc = {doc: val};
    var serialized_data = new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serialize(doc, false, true);

    var serialized_data2 = new Buffer(new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).calculateObjectSize(doc, false, true));
    new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serializeWithBufferAndIndex(doc, false, serialized_data2, 0);    
    assertBuffersEqual(test, serialized_data, serialized_data2, 0);

    var deserialized_data = new BSONDE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).deserialize(serialized_data);
    test.deepEqual(doc.doc, deserialized_data.doc);
  };

  roundTrip(Math.pow(2,52));
  roundTrip(Math.pow(2,53) - 1);
  roundTrip(Math.pow(2,53));
  roundTrip(-Math.pow(2,52));
  roundTrip(-Math.pow(2,53) + 1);
  roundTrip(-Math.pow(2,53));
  roundTrip(Math.pow(2,65));  // Too big for Long.
  roundTrip(-Math.pow(2,65));
  roundTrip(9223372036854775807);
  roundTrip(1234567890123456800);  // Bigger than 2^53, stays a double.
  roundTrip(-1234567890123456800);
  test.done();
}
    
/**
 * @ignore
 */
exports['Should Correctly Serialize and Deserialize Long Integer and Timestamp as different types'] = function(test) {
  var long = Long.fromNumber(9223372036854775807);
  var timestamp = Timestamp.fromNumber(9223372036854775807);
  test.ok(long instanceof Long);
  test.ok(!(long instanceof Timestamp));
  test.ok(timestamp instanceof Timestamp);
  test.ok(!(timestamp instanceof Long));
  
  var test_int = {doc: long, doc2: timestamp};
  var serialized_data = new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serialize(test_int, false, true);

  var serialized_data2 = new Buffer(new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).calculateObjectSize(test_int));
  new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serializeWithBufferAndIndex(test_int, false, serialized_data2, 0);    
  assertBuffersEqual(test, serialized_data, serialized_data2, 0);

  var deserialized_data = new BSONDE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).deserialize(serialized_data);  
  test.deepEqual(test_int.doc, deserialized_data.doc);
  test.done();        
}

/**
 * @ignore
 */
exports['Should Always put the id as the first item in a hash'] = function(test) {
  var hash = {doc: {not_id:1, '_id':2}};
  var serialized_data = new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serialize(hash, false, true);

  var serialized_data2 = new Buffer(new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).calculateObjectSize(hash));
  new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serializeWithBufferAndIndex(hash, false, serialized_data2, 0);    
  assertBuffersEqual(test, serialized_data, serialized_data2, 0);

  var deserialized_data = new BSONDE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).deserialize(serialized_data);
  var keys = [];

  for(var name in deserialized_data.doc) {
    keys.push(name);
  }
  
  test.deepEqual(['not_id', '_id'], keys);
  test.done();        
}

/**
 * @ignore
 */
exports['Should Correctly Serialize and Deserialize a User defined Binary object'] = function(test) {
  var bin = new Binary();
  bin.sub_type = BSON.BSON_BINARY_SUBTYPE_USER_DEFINED;
  var string = 'binstring';
  for(var index = 0; index < string.length; index++) {
    bin.put(string.charAt(index));
  }

  var doc = {doc: bin};
  var serialized_data = new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serialize(doc, false, true);

  var serialized_data2 = new Buffer(new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).calculateObjectSize(doc, false, true));
  new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serializeWithBufferAndIndex(doc, false, serialized_data2, 0);    
  assertBuffersEqual(test, serialized_data, serialized_data2, 0);
  var deserialized_data = new BSONDE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).deserialize(serialized_data);
  
  test.deepEqual(deserialized_data.doc.sub_type, BSON.BSON_BINARY_SUBTYPE_USER_DEFINED);
  test.deepEqual(doc.doc.value(), deserialized_data.doc.value());
  test.done();        
}

/**
 * @ignore
 */
exports['Should Correclty Serialize and Deserialize a Code object']  = function(test) {
  var doc = {'doc': {'doc2': new Code('this.a > i', {i:1})}};
  var serialized_data = new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serialize(doc, false, true);  
  var serialized_data2 = new Buffer(new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).calculateObjectSize(doc, false, true));
  new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serializeWithBufferAndIndex(doc, false, serialized_data2, 0);    
  assertBuffersEqual(test, serialized_data, serialized_data2, 0);

  var deserialized_data = new BSONDE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).deserialize(serialized_data);    
  test.deepEqual(doc.doc.doc2.code, deserialized_data.doc.doc2.code);
  test.deepEqual(doc.doc.doc2.scope.i, deserialized_data.doc.doc2.scope.i);
  test.done();        
}

/**
 * @ignore
 */
exports['Should Correctly serialize and deserialize and embedded array'] = function(test) {
  var doc = {'a':0,
    'b':['tmp1', 'tmp2', 'tmp3', 'tmp4', 'tmp5', 'tmp6', 'tmp7', 'tmp8', 'tmp9', 'tmp10', 'tmp11', 'tmp12', 'tmp13', 'tmp14', 'tmp15', 'tmp16']
  };

  var serialized_data = new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serialize(doc, false, true);

  var serialized_data2 = new Buffer(new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).calculateObjectSize(doc, false, true));
  new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serializeWithBufferAndIndex(doc, false, serialized_data2, 0);    
  assertBuffersEqual(test, serialized_data, serialized_data2, 0);

  var deserialized_data = new BSONDE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).deserialize(serialized_data);    
  test.deepEqual(doc.a, deserialized_data.a);
  test.deepEqual(doc.b, deserialized_data.b);
  test.done();        
}

/**
 * @ignore
 */
exports['Should Correctly Serialize and Deserialize UTF8'] = function(test) {
  // Serialize utf8
  var doc = { "name" : "本荘由利地域に洪水警報", "name1" : "öüóőúéáűíÖÜÓŐÚÉÁŰÍ", "name2" : "abcdedede"};
  var serialized_data = new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serialize(doc, false, true);

  var serialized_data2 = new Buffer(new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).calculateObjectSize(doc, false, true));
  new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serializeWithBufferAndIndex(doc, false, serialized_data2, 0);    
  assertBuffersEqual(test, serialized_data, serialized_data2, 0);

  var deserialized_data = new BSONDE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).deserialize(serialized_data);
  test.deepEqual(doc, deserialized_data);
  test.done();
}

/**
 * @ignore
 */
exports['Should Correctly Serialize and Deserialize query object'] = function(test) {
  var doc = { count: 'remove_with_no_callback_bug_test', query: {}, fields: null};
  var serialized_data = new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serialize(doc, false, true);

  var serialized_data2 = new Buffer(new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).calculateObjectSize(doc, false, true));
  new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serializeWithBufferAndIndex(doc, false, serialized_data2, 0);    
  assertBuffersEqual(test, serialized_data, serialized_data2, 0);

  var deserialized_data = new BSONDE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).deserialize(serialized_data);    
  test.deepEqual(doc, deserialized_data);
  test.done();
}

/**
 * @ignore
 */
exports['Should Correctly Serialize and Deserialize empty query object'] = function(test) {
  var doc = {};
  var serialized_data = new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serialize(doc, false, true);

  var serialized_data2 = new Buffer(new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).calculateObjectSize(doc, false, true));
  new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serializeWithBufferAndIndex(doc, false, serialized_data2, 0);    
  assertBuffersEqual(test, serialized_data, serialized_data2, 0);

  var deserialized_data = new BSONDE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).deserialize(serialized_data);
  test.deepEqual(doc, deserialized_data);
  test.done();
}

/**
 * @ignore
 */
exports['Should Correctly Serialize and Deserialize array based doc'] = function(test) {
  var doc = { b: [ 1, 2, 3 ], _id: new ObjectID() };
  var serialized_data = new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serialize(doc, false, true);

  var serialized_data2 = new Buffer(new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).calculateObjectSize(doc, false, true));
  new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serializeWithBufferAndIndex(doc, false, serialized_data2, 0);    
  assertBuffersEqual(test, serialized_data, serialized_data2, 0);

  var deserialized_data = new BSONDE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).deserialize(serialized_data);
  test.deepEqual(doc.b, deserialized_data.b)
  test.deepEqual(doc, deserialized_data);
  test.done();
}

/**
 * @ignore
 */
exports['Should Correctly Serialize and Deserialize Symbol'] = function(test) {
  if(Symbol != null) {
    var doc = { b: [ new Symbol('test') ]};
    var serialized_data = new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serialize(doc, false, true);

    var serialized_data2 = new Buffer(new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).calculateObjectSize(doc, false, true));
    new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serializeWithBufferAndIndex(doc, false, serialized_data2, 0);    
    assertBuffersEqual(test, serialized_data, serialized_data2, 0);
        
    var deserialized_data = new BSONDE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).deserialize(serialized_data);
    test.deepEqual(doc.b, deserialized_data.b)
    test.deepEqual(doc, deserialized_data);
    test.ok(deserialized_data.b[0] instanceof Symbol);
  }
  
  test.done();
}

/**
 * @ignore
 */
exports['Should handle Deeply nested document'] = function(test) {
  var doc = {a:{b:{c:{d:2}}}};
  var serialized_data = new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serialize(doc, false, true);

  var serialized_data2 = new Buffer(new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).calculateObjectSize(doc, false, true));
  new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serializeWithBufferAndIndex(doc, false, serialized_data2, 0);    
  assertBuffersEqual(test, serialized_data, serialized_data2, 0);

  var deserialized_data = new BSONDE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).deserialize(serialized_data);    
  test.deepEqual(doc, deserialized_data);
  test.done();
}

/**
 * @ignore
 */
exports['Should handle complicated all typed object'] = function(test) {
  // First doc
  var date = new Date();
  var oid = new ObjectID();
  var string = 'binstring'
  var bin = new Binary()
  for(var index = 0; index < string.length; index++) {
    bin.put(string.charAt(index))
  }

  var doc = {
    'string': 'hello',
    'array': [1,2,3],
    'hash': {'a':1, 'b':2},
    'date': date,
    'oid': oid,
    'binary': bin,
    'int': 42,
    'float': 33.3333,
    'regexp': /regexp/,
    'boolean': true,
    'long': date.getTime(),
    'where': new Code('this.a > i', {i:1}),
    'dbref': new DBRef('namespace', oid, 'integration_tests_')
  }

  // Second doc
  var oid = new ObjectID.createFromHexString(oid.toHexString());
  var string = 'binstring'
  var bin = new Binary()
  for(var index = 0; index < string.length; index++) {
    bin.put(string.charAt(index))
  }

  var doc2 = {
    'string': 'hello',
    'array': [1,2,3],
    'hash': {'a':1, 'b':2},
    'date': date,
    'oid': oid,
    'binary': bin,
    'int': 42,
    'float': 33.3333,
    'regexp': /regexp/,
    'boolean': true,
    'long': date.getTime(),
    'where': new Code('this.a > i', {i:1}),
    'dbref': new DBRef('namespace', oid, 'integration_tests_')
  }

  var serialized_data = new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serialize(doc, false, true);

  var serialized_data2 = new Buffer(new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).calculateObjectSize(doc, false, true));
  new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serializeWithBufferAndIndex(doc, false, serialized_data2, 0);    
  assertBuffersEqual(test, serialized_data, serialized_data2, 0);

  var serialized_data2 = new BSONDE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serialize(doc2, false, true);

  for(var i = 0; i < serialized_data2.length; i++) {
    require('assert').equal(serialized_data2[i], serialized_data[i])      
  }

  test.done();    
}

/**
 * @ignore
 */
exports['Should Correctly Serialize Complex Nested Object'] = function(test) {
  var doc = { email: 'email@email.com',
        encrypted_password: 'password',
        friends: [ '4db96b973d01205364000006',
           '4dc77b24c5ba38be14000002' ],
        location: [ 72.4930088, 23.0431957 ],
        name: 'Amit Kumar',
        password_salt: 'salty',
        profile_fields: [],
        username: 'amit',
        _id: new ObjectID() }
        
  var serialized_data = new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serialize(doc, false, true);

  var serialized_data2 = new Buffer(new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).calculateObjectSize(doc, false, true));
  new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serializeWithBufferAndIndex(doc, false, serialized_data2, 0);    
  assertBuffersEqual(test, serialized_data, serialized_data2, 0);
  
  var doc2 = doc;
  doc2._id = ObjectID.createFromHexString(doc2._id.toHexString());
  var serialized_data2 = new BSONDE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serialize(doc2, false, true);

  for(var i = 0; i < serialized_data2.length; i++) {
    require('assert').equal(serialized_data2[i], serialized_data[i])      
  }

  test.done();
}

/**
 * @ignore
 */
exports['Should correctly massive doc'] = function(test) {
  var oid1 = new ObjectID();
  var oid2 = new ObjectID();

  // JS doc
  var doc = { dbref2: new DBRef('namespace', oid1, 'integration_tests_'),
       _id: oid2 };

  var doc2 = { dbref2: new DBRef('namespace', ObjectID.createFromHexString(oid1.toHexString()), 'integration_tests_'),
      _id: new ObjectID.createFromHexString(oid2.toHexString()) };

  var serialized_data = new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serialize(doc, false, true);

  var serialized_data2 = new Buffer(new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).calculateObjectSize(doc, false, true));
  new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serializeWithBufferAndIndex(doc, false, serialized_data2, 0);    
  assertBuffersEqual(test, serialized_data, serialized_data2, 0);

  var serialized_data2 = new BSONDE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serialize(doc2, false, true);
  test.done();
}

/**
 * @ignore
 */
exports['Should Correctly Serialize/Deserialize regexp object'] = function(test) {
  var doc = {'b':/foobaré/};

  var serialized_data = new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serialize(doc, false, true);

  var serialized_data2 = new Buffer(new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).calculateObjectSize(doc, false, true));
  new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serializeWithBufferAndIndex(doc, false, serialized_data2, 0);    
  assertBuffersEqual(test, serialized_data, serialized_data2, 0);

  var serialized_data2 = new BSONDE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serialize(doc, false, true);

  for(var i = 0; i < serialized_data2.length; i++) {
    require('assert').equal(serialized_data2[i], serialized_data[i])      
  }

  test.done();
}

/**
 * @ignore
 */
exports['Should Correctly Serialize/Deserialize complicated object'] = function(test) {
  var doc = {a:{b:{c:[new ObjectID(), new ObjectID()]}}, d:{f:1332.3323}};

  var serialized_data = new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serialize(doc, false, true);

  var serialized_data2 = new Buffer(new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).calculateObjectSize(doc, false, true));
  new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serializeWithBufferAndIndex(doc, false, serialized_data2, 0);    
  assertBuffersEqual(test, serialized_data, serialized_data2, 0);

  var doc2 = new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).deserialize(serialized_data);

  test.deepEqual(doc, doc2)
  test.done();
}

/**
 * @ignore
 */
exports['Should Correctly Serialize/Deserialize nested object'] = function(test) {
  var doc = { "_id" : { "date" : new Date(), "gid" : "6f35f74d2bea814e21000000" }, 
    "value" : { 
          "b" : { "countries" : { "--" : 386 }, "total" : 1599 }, 
          "bc" : { "countries" : { "--" : 3 }, "total" : 10 }, 
          "gp" : { "countries" : { "--" : 2 }, "total" : 13 }, 
          "mgc" : { "countries" : { "--" : 2 }, "total" : 14 } 
        }
    }

  var serialized_data = new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serialize(doc, false, true);

  var serialized_data2 = new Buffer(new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).calculateObjectSize(doc, false, true));
  new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serializeWithBufferAndIndex(doc, false, serialized_data2, 0);    
  assertBuffersEqual(test, serialized_data, serialized_data2, 0);

  var doc2 = new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).deserialize(serialized_data);

  test.deepEqual(doc, doc2)
  test.done();
}

/**
 * @ignore
 */
exports['Should Correctly Serialize/Deserialize nested object with even more nesting'] = function(test) {
  var doc = { "_id" : { "date" : {a:1, b:2, c:new Date()}, "gid" : "6f35f74d2bea814e21000000" }, 
    "value" : { 
          "b" : { "countries" : { "--" : 386 }, "total" : 1599 }, 
          "bc" : { "countries" : { "--" : 3 }, "total" : 10 }, 
          "gp" : { "countries" : { "--" : 2 }, "total" : 13 }, 
          "mgc" : { "countries" : { "--" : 2 }, "total" : 14 } 
        }
    }

  var serialized_data = new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serialize(doc, false, true);

  var serialized_data2 = new Buffer(new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).calculateObjectSize(doc, false, true));
  new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serializeWithBufferAndIndex(doc, false, serialized_data2, 0);    
  assertBuffersEqual(test, serialized_data, serialized_data2, 0);

  var doc2 = new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).deserialize(serialized_data);
  test.deepEqual(doc, doc2)
  test.done();
}

/**
 * @ignore
 */
exports['Should Correctly Serialize empty name object'] = function(test) {
  var doc = {'':'test',
    'bbbb':1};
  var serialized_data = new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serialize(doc, false, true);
  var doc2 = new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).deserialize(serialized_data);
  test.equal(doc2[''], 'test');
  test.equal(doc2['bbbb'], 1);
  test.done();
}
  
/**
 * @ignore
 */
exports['Should Correctly handle Forced Doubles to ensure we allocate enough space for cap collections'] = function(test) {
  if(Double != null) {
    var doubleValue = new Double(100);
    var doc = {value:doubleValue};

    // Serialize
    var serialized_data = new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serialize(doc, false, true);

    var serialized_data2 = new Buffer(new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).calculateObjectSize(doc, false, true));
    new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serializeWithBufferAndIndex(doc, false, serialized_data2, 0);    
    assertBuffersEqual(test, serialized_data, serialized_data2, 0);

    var doc2 = new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).deserialize(serialized_data);
    test.deepEqual({value:100}, doc2);
  }    

  test.done();      
}

/**
 * @ignore
 */
exports['Should deserialize correctly'] = function(test) {
  var doc = {
   "_id" : new ObjectID("4e886e687ff7ef5e00000162"),
   "str" : "foreign",
   "type" : 2,
   "timestamp" : ISODate("2011-10-02T14:00:08.383Z"),
   "links" : [
     "http://www.reddit.com/r/worldnews/comments/kybm0/uk_home_secretary_calls_for_the_scrapping_of_the/"
   ]
  }    
  
  var serialized_data = new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serialize(doc, false, true);  
  var serialized_data2 = new Buffer(new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).calculateObjectSize(doc, false, true));
  new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serializeWithBufferAndIndex(doc, false, serialized_data2, 0);    
  assertBuffersEqual(test, serialized_data, serialized_data2, 0);  
  var doc2 = new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).deserialize(serialized_data);

  test.deepEqual(doc, doc2)
  test.done();    
}

/**
 * @ignore
 */
exports['Should correctly serialize and deserialize MinKey and MaxKey values'] = function(test) {
  var doc = {
      _id : new ObjectID("4e886e687ff7ef5e00000162"),
      minKey : new MinKey(),
      maxKey : new MaxKey()
    }
  
  var serialized_data = new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serialize(doc, false, true);  
  var serialized_data2 = new Buffer(new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).calculateObjectSize(doc, false, true));
  new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serializeWithBufferAndIndex(doc, false, serialized_data2, 0);    
  assertBuffersEqual(test, serialized_data, serialized_data2, 0);  
  var doc2 = new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).deserialize(serialized_data);

  test.deepEqual(doc, doc2)
  test.ok(doc2.minKey instanceof MinKey);
  test.ok(doc2.maxKey instanceof MaxKey);
  test.done();
}

/**
 * @ignore
 */
exports['Should correctly serialize Double value'] = function(test) {
  var doc = {
      value : new Double(34343.2222)
    }

  var serialized_data = new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serialize(doc, false, true);  
  var serialized_data2 = new Buffer(new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).calculateObjectSize(doc, false, true));
  new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serializeWithBufferAndIndex(doc, false, serialized_data2, 0);    
  assertBuffersEqual(test, serialized_data, serialized_data2, 0);  
  var doc2 = new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).deserialize(serialized_data);

  test.ok(doc.value.valueOf(), doc2.value);
  test.ok(doc.value.value, doc2.value);
  test.done();    
}

/**
 * @ignore
 */
exports['ObjectID should correctly create objects'] = function(test) {
  try {
    var object1 = ObjectID.createFromHexString('000000000000000000000001')
    var object2 = ObjectID.createFromHexString('00000000000000000000001')      
    test.ok(false);
  } catch(err) {
    test.ok(err != null);
  }
  
  test.done();
}

/**
 * @ignore
 */
exports['ObjectID should correctly retrieve timestamp'] = function(test) {
  var testDate = new Date();
  var object1 = new ObjectID();
  test.equal(Math.floor(testDate.getTime()/1000), Math.floor(object1.getTimestamp().getTime()/1000));
  test.done();
}

/**
 * @ignore
 */
exports['Should Correctly throw error on bsonparser errors'] = function(test) {
  var data = new Buffer(3);
  var parser = new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]);
  
  // Catch to small buffer error
  try {
    parser.deserialize(data);
    test.ok(false);
  } catch(err) {}
  
  data = new Buffer(5);
  data[0] = 0xff;
  data[1] = 0xff;
  // Catch illegal size
  try {
    parser.deserialize(data);
    test.ok(false);
  } catch(err) {}

  // Finish up
  test.done();
}

/**
 * A simple example showing the usage of BSON.calculateObjectSize function returning the number of BSON bytes a javascript object needs.
 *
 * @_class bson
 * @_function BSON.calculateObjectSize
 * @ignore
 */
exports['Should correctly calculate the size of a given javascript object'] = function(test) {  
  // Create a simple object
  var doc = {a: 1, func:function(){}}
  // Calculate the size of the object without serializing the function
  var size = BSON.calculateObjectSize(doc, false);
  test.equal(12, size);
  // Calculate the size of the object serializing the function
  size = BSON.calculateObjectSize(doc, true);
  // Validate the correctness
  test.equal(36, size);
  test.done();    
}

/**
 * A simple example showing the usage of BSON.calculateObjectSize function returning the number of BSON bytes a javascript object needs.
 *
 * @_class bson
 * @_function calculateObjectSize
 * @ignore
 */
exports['Should correctly calculate the size of a given javascript object using instance method'] = function(test) {  
  // Create a simple object
  var doc = {a: 1, func:function(){}}
  // Create a BSON parser instance
  var bson = new BSON();
  // Calculate the size of the object without serializing the function
  var size = bson.calculateObjectSize(doc, false);
  test.equal(12, size);
  // Calculate the size of the object serializing the function
  size = bson.calculateObjectSize(doc, true);
  // Validate the correctness
  test.equal(36, size);
  test.done();    
}

/**
 * A simple example showing the usage of BSON.serializeWithBufferAndIndex function.
 *
 * @_class bson
 * @_function BSON.serializeWithBufferAndIndex
 * @ignore
 */
exports['Should correctly serializeWithBufferAndIndex a given javascript object'] = function(test) {  
  // Create a simple object
  var doc = {a: 1, func:function(){}}
  // Calculate the size of the document, no function serialization
  var size = BSON.calculateObjectSize(doc, false);
  // Allocate a buffer
  var buffer = new Buffer(size);
  // Serialize the object to the buffer, checking keys and not serializing functions
  var index = BSON.serializeWithBufferAndIndex(doc, true, buffer, 0, false);
  // Validate the correctness
  test.equal(12, size);
  test.equal(11, index);
  
  // Serialize with functions
  // Calculate the size of the document, no function serialization
  var size = BSON.calculateObjectSize(doc, true);
  // Allocate a buffer
  var buffer = new Buffer(size);
  // Serialize the object to the buffer, checking keys and not serializing functions
  var index = BSON.serializeWithBufferAndIndex(doc, true, buffer, 0, true);
  // Validate the correctness
  test.equal(36, size);
  test.equal(35, index);  
  test.done();    
}

/**
 * A simple example showing the usage of BSON.serializeWithBufferAndIndex function.
 *
 * @_class bson
 * @_function serializeWithBufferAndIndex
 * @ignore
 */
exports['Should correctly serializeWithBufferAndIndex a given javascript object using a BSON instance'] = function(test) {  
  // Create a simple object
  var doc = {a: 1, func:function(){}}
  // Create a BSON parser instance
  var bson = new BSON();
  // Calculate the size of the document, no function serialization
  var size = bson.calculateObjectSize(doc, false);
  // Allocate a buffer
  var buffer = new Buffer(size);
  // Serialize the object to the buffer, checking keys and not serializing functions
  var index = bson.serializeWithBufferAndIndex(doc, true, buffer, 0, false);
  // Validate the correctness
  test.equal(12, size);
  test.equal(11, index);
  
  // Serialize with functions
  // Calculate the size of the document, no function serialization
  var size = bson.calculateObjectSize(doc, true);
  // Allocate a buffer
  var buffer = new Buffer(size);
  // Serialize the object to the buffer, checking keys and not serializing functions
  var index = bson.serializeWithBufferAndIndex(doc, true, buffer, 0, true);
  // Validate the correctness
  test.equal(36, size);
  test.equal(35, index);  
  test.done();    
}

/**
 * A simple example showing the usage of BSON.serialize function returning serialized BSON Buffer object.
 *
 * @_class bson
 * @_function BSON.serialize
 * @ignore
 */
exports['Should correctly serialize a given javascript object'] = function(test) {  
  // Create a simple object
  var doc = {a: 1, func:function(){}}
  // Serialize the object to a buffer, checking keys and not serializing functions
  var buffer = BSON.serialize(doc, true, true, false);
  // Validate the correctness
  test.equal(12, buffer.length);
  
  // Serialize the object to a buffer, checking keys and serializing functions
  var buffer = BSON.serialize(doc, true, true, true);
  // Validate the correctness
  test.equal(36, buffer.length);
  test.done();    
}

/**
 * A simple example showing the usage of BSON.serialize function returning serialized BSON Buffer object.
 *
 * @_class bson
 * @_function serialize
 * @ignore
 */
exports['Should correctly serialize a given javascript object using a bson instance'] = function(test) {  
  // Create a simple object
  var doc = {a: 1, func:function(){}}
  // Create a BSON parser instance
  var bson = new BSON();
  // Serialize the object to a buffer, checking keys and not serializing functions
  var buffer = bson.serialize(doc, true, true, false);
  // Validate the correctness
  test.equal(12, buffer.length);
  
  // Serialize the object to a buffer, checking keys and serializing functions
  var buffer = bson.serialize(doc, true, true, true);
  // Validate the correctness
  test.equal(36, buffer.length);
  test.done();    
}

/**
 * A simple example showing the usage of BSON.deserialize function returning a deserialized Javascript function.
 *
 * @_class bson
 * @_function BSON.deserialize
 * @ignore
 */
 exports['Should correctly deserialize a buffer using the BSON class level parser'] = function(test) {  
  // Create a simple object
  var doc = {a: 1, func:function(){ console.log('hello world'); }}
  // Serialize the object to a buffer, checking keys and serializing functions
  var buffer = BSON.serialize(doc, true, true, true);
  // Validate the correctness
  test.equal(65, buffer.length);

  // Deserialize the object with no eval for the functions
  var deserializedDoc = BSON.deserialize(buffer);
  // Validate the correctness
  test.equal('object', typeof deserializedDoc.func);
  test.equal(1, deserializedDoc.a);

  // Deserialize the object with eval for the functions caching the functions
  deserializedDoc = BSON.deserialize(buffer, {evalFunctions:true, cacheFunctions:true});
  // Validate the correctness
  test.equal('function', typeof deserializedDoc.func);
  test.equal(1, deserializedDoc.a);
  test.done();    
}

/**
 * A simple example showing the usage of BSON instance deserialize function returning a deserialized Javascript function.
 *
 * @_class bson
 * @_function deserialize
 * @ignore
 */
exports['Should correctly deserialize a buffer using the BSON instance parser'] = function(test) {  
  // Create a simple object
  var doc = {a: 1, func:function(){ console.log('hello world'); }}
  // Create a BSON parser instance
  var bson = new BSON();
  // Serialize the object to a buffer, checking keys and serializing functions
  var buffer = bson.serialize(doc, true, true, true);
  // Validate the correctness
  test.equal(65, buffer.length);

  // Deserialize the object with no eval for the functions
  var deserializedDoc = bson.deserialize(buffer);
  // Validate the correctness
  test.equal('object', typeof deserializedDoc.func);
  test.equal(1, deserializedDoc.a);

  // Deserialize the object with eval for the functions caching the functions
  deserializedDoc = bson.deserialize(buffer, {evalFunctions:true, cacheFunctions:true});
  // Validate the correctness
  test.equal('function', typeof deserializedDoc.func);
  test.equal(1, deserializedDoc.a);
  test.done();    
}

/**
 * A simple example showing the usage of BSON.deserializeStream function returning deserialized Javascript objects.
 *
 * @_class bson
 * @_function BSON.deserializeStream
 * @ignore
 */
exports['Should correctly deserializeStream a buffer object'] = function(test) {  
  // Create a simple object
  var doc = {a: 1, func:function(){ console.log('hello world'); }}
  // Serialize the object to a buffer, checking keys and serializing functions
  var buffer = BSON.serialize(doc, true, true, true);
  // Validate the correctness
  test.equal(65, buffer.length);

  // The array holding the number of retuned documents
  var documents = new Array(1);
  // Deserialize the object with no eval for the functions
  var index = BSON.deserializeStream(buffer, 0, 1, documents, 0);
  // Validate the correctness
  test.equal(65, index);
  test.equal(1, documents.length);
  test.equal(1, documents[0].a);
  test.equal('object', typeof documents[0].func);

  // Deserialize the object with eval for the functions caching the functions
  // The array holding the number of retuned documents
  var documents = new Array(1);
  // Deserialize the object with no eval for the functions
  var index = BSON.deserializeStream(buffer, 0, 1, documents, 0, {evalFunctions:true, cacheFunctions:true});
  // Validate the correctness
  test.equal(65, index);
  test.equal(1, documents.length);
  test.equal(1, documents[0].a);
  test.equal('function', typeof documents[0].func);
  test.done();    
}

/**
 * A simple example showing the usage of BSON instance deserializeStream function returning deserialized Javascript objects.
 *
 * @_class bson
 * @_function deserializeStream
 * @ignore
 */
exports['Should correctly deserializeStream a buffer object'] = function(test) {  
  // Create a simple object
  var doc = {a: 1, func:function(){ console.log('hello world'); }}
  // Create a BSON parser instance
  var bson = new BSON();
  // Serialize the object to a buffer, checking keys and serializing functions
  var buffer = bson.serialize(doc, true, true, true);
  // Validate the correctness
  test.equal(65, buffer.length);

  // The array holding the number of retuned documents
  var documents = new Array(1);
  // Deserialize the object with no eval for the functions
  var index = bson.deserializeStream(buffer, 0, 1, documents, 0);
  // Validate the correctness
  test.equal(65, index);
  test.equal(1, documents.length);
  test.equal(1, documents[0].a);
  test.equal('object', typeof documents[0].func);

  // Deserialize the object with eval for the functions caching the functions
  // The array holding the number of retuned documents
  var documents = new Array(1);
  // Deserialize the object with no eval for the functions
  var index = bson.deserializeStream(buffer, 0, 1, documents, 0, {evalFunctions:true, cacheFunctions:true});
  // Validate the correctness
  test.equal(65, index);
  test.equal(1, documents.length);
  test.equal(1, documents[0].a);
  test.equal('function', typeof documents[0].func);
  test.done();    
}

/**
 * @ignore
 */
exports['ObjectID should have a correct cached representation of the hexString'] = function (test) {
  ObjectID.cacheHexString = true;
  var a = new ObjectID;
  var __id = a.__id;
  test.equal(__id, a.toHexString());

  // hexString
  a = new ObjectID(__id);
  test.equal(__id, a.toHexString());

  // fromHexString
  a = ObjectID.createFromHexString(__id);
  test.equal(a.__id, a.toHexString());
  test.equal(__id, a.toHexString());

  // number
  var genTime = a.generationTime;
  a = new ObjectID(genTime);
   __id = a.__id;
  test.equal(__id, a.toHexString());

  // generationTime
  delete a.__id;
  a.generationTime = genTime;
  test.equal(__id, a.toHexString());

  // createFromTime
  a = ObjectId.createFromTime(genTime);
  __id = a.__id;
  test.equal(__id, a.toHexString());
  ObjectId.cacheHexString = false;

  test.done();
}

/**
 * @ignore
 */
// 'Should Correctly Function' = function(test) {
//   var doc = {b:1, func:function() {
//     this.b = 2;
//   }};
//     
//   var serialized_data = new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serialize(doc, false, true);
//   
//   debug("----------------------------------------------------------------------")
//   debug(inspect(serialized_data))
//     
//   // var serialized_data2 = new Buffer(new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).calculateObjectSize(doc, false, true));
//   // new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serializeWithBufferAndIndex(doc, false, serialized_data2, 0);    
//   // assertBuffersEqual(test, serialized_data, serialized_data2, 0);
//   var COUNT = 100000;
//     
//   // var b = null;
//   // eval("b = function(x) { return x+x; }");
//   // var b = new Function("x", "return x+x;");
//     
//   console.log(COUNT + "x (objectBSON = BSON.serialize(object))")
//   start = new Date
//   
//   for (i=COUNT; --i>=0; ) {
//     var doc2 = new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).deserialize(serialized_data, {evalFunctions: true, cacheFunctions:true});
//   }
//     
//   end = new Date
//   console.log("time = ", end - start, "ms -", COUNT * 1000 / (end - start), " ops/sec")
//     
//   // debug(inspect(new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).functionCache))
//   //   
//   // var doc2 = new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).deserialize(serialized_data, {evalFunctions: true, cacheFunctions:true});
//   // // test.deepEqual(doc, doc2)
//   // // 
//   // debug(inspect(doc2))
//   // doc2.func()
//   // debug(inspect(doc2))
//   // 
//   // var serialized_data = new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).serialize(doc2, false, true);
//   // var doc3 = new BSONSE.BSON([Long, ObjectID, Binary, Code, DBRef, Symbol, Double, Timestamp, MaxKey, MinKey]).deserialize(serialized_data, {evalFunctions: true, cacheFunctions:true});
//   // 
//   // debug("-----------------------------------------------")
//   // debug(inspect(doc3))
//   
//   // var key = "0"
//   // for(var i = 1; i < 10000; i++) {
//   //   key = key + " " + i
//   // }
//   
//   test.done();
//   
//   
//   // var car = {
//   //   model : "Volvo",
//   //   country : "Sweden",
//   //   
//   //   isSwedish : function() {
//   //     return this.country == "Sweden";
//   //   }
//   // }
//   
// },

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
