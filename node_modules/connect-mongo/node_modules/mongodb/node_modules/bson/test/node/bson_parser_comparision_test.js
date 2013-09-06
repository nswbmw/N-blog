var sys = require('util'),
  debug = require('util').debug,
  inspect = require('util').inspect,
  Buffer = require('buffer').Buffer,
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

// Long/ObjectID/Binary/Code/DbRef/Symbol/Double/Timestamp/MinKey/MaxKey
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
exports['Should Correctly Serialize and Deserialize simple edge value'] = function(test) {
  // Simple serialization and deserialization of edge value
  var doc = {doc:0x1ffffffffffffe};
  var simple_string_serialized = bsonC.serialize(doc, false, true);
  assert.deepEqual(simple_string_serialized, bsonJS.serialize(doc, false, true));
  assert.deepEqual(bsonJS.deserialize(new Buffer(simple_string_serialized, 'binary')), bsonC.deserialize(simple_string_serialized));

  var doc = {doc:-0x1ffffffffffffe};
  var simple_string_serialized = bsonC.serialize(doc, false, true);
  assert.deepEqual(simple_string_serialized, bsonJS.serialize(doc, false, true));
  assert.deepEqual(bsonJS.deserialize(new Buffer(simple_string_serialized, 'binary')), bsonC.deserialize(simple_string_serialized));
  test.done();
}

/**
 * @ignore
 */
exports['Should Correctly execute toJSON'] = function(test) {
  var a = Long.fromNumber(10);
  assert.equal(10, a);

  var a = Long.fromNumber(9223372036854775807);
  assert.equal(9223372036854775807, a);

  // Simple serialization and deserialization test for a Single String value
  var doc = {doc:'Serialize'};
  var simple_string_serialized = bsonC.serialize(doc, true, false);

  assert.deepEqual(simple_string_serialized, bsonJS.serialize(doc, false, true));
  assert.deepEqual(bsonJS.deserialize(new Buffer(simple_string_serialized, 'binary')), bsonC.deserialize(simple_string_serialized));
  test.done();
}

/**
 * @ignore
 */
exports['Should Serialize and Deserialize nested document'] = function(test) {
  // Nested doc
  var doc = {a:{b:{c:1}}};
  var simple_string_serialized = bsonC.serialize(doc, false, true);

  assert.deepEqual(simple_string_serialized, bsonJS.serialize(doc, false, true));
  assert.deepEqual(bsonJS.deserialize(new Buffer(simple_string_serialized, 'binary')), bsonC.deserialize(simple_string_serialized));
  test.done();
}

/**
 * @ignore
 */
exports['Simple integer serialization/deserialization test, including testing boundary conditions'] = function(test) {
  var doc = {doc:-1};
  var simple_string_serialized = bsonC.serialize(doc, false, true);
  assert.deepEqual(simple_string_serialized, bsonJS.serialize(doc, false, true));
  assert.deepEqual(bsonJS.deserialize(new Buffer(simple_string_serialized, 'binary')), bsonC.deserialize(simple_string_serialized));

  var doc = {doc:2147483648};
  var simple_string_serialized = bsonC.serialize(doc, false, true);
  assert.deepEqual(bsonJS.deserialize(new Buffer(simple_string_serialized, 'binary')), bsonC.deserialize(simple_string_serialized));

  var doc = {doc:-2147483648};
  var simple_string_serialized = bsonC.serialize(doc, false, true);
  assert.deepEqual(simple_string_serialized, bsonJS.serialize(doc, false, true));
  assert.deepEqual(bsonJS.deserialize(new Buffer(simple_string_serialized, 'binary')), bsonC.deserialize(simple_string_serialized));
  test.done();
}

/**
 * @ignore
 */
exports['Simple serialization and deserialization test for a Long value'] = function(test) {
  var doc = {doc:Long.fromNumber(9223372036854775807)};
  var simple_string_serialized = bsonC.serialize(doc, false, true);
  assert.deepEqual(simple_string_serialized, bsonJS.serialize({doc:Long.fromNumber(9223372036854775807)}, false, true));
  assert.deepEqual(bsonJS.deserialize(new Buffer(simple_string_serialized, 'binary')), bsonC.deserialize(simple_string_serialized));

  var doc = {doc:Long.fromNumber(-9223372036854775807)};
  var simple_string_serialized = bsonC.serialize(doc, false, true);
  assert.deepEqual(simple_string_serialized, bsonJS.serialize({doc:Long.fromNumber(-9223372036854775807)}, false, true));
  assert.deepEqual(bsonJS.deserialize(new Buffer(simple_string_serialized, 'binary')), bsonC.deserialize(simple_string_serialized));
  test.done();
}

/**
 * @ignore
 */
exports['Simple serialization and deserialization for a Float value'] = function(test) {
  var doc = {doc:2222.3333};
  var simple_string_serialized = bsonC.serialize(doc, false, true);
  assert.deepEqual(simple_string_serialized, bsonJS.serialize(doc, false, true));
  assert.deepEqual(bsonJS.deserialize(new Buffer(simple_string_serialized, 'binary')), bsonC.deserialize(simple_string_serialized));

  var doc = {doc:-2222.3333};
  var simple_string_serialized = bsonC.serialize(doc, false, true);
  assert.deepEqual(simple_string_serialized, bsonJS.serialize(doc, false, true));
  assert.deepEqual(bsonJS.deserialize(new Buffer(simple_string_serialized, 'binary')), bsonC.deserialize(simple_string_serialized));
  test.done();
}

/**
 * @ignore
 */
exports['Simple serialization and deserialization for a null value'] = function(test) {
  var doc = {doc:null};
  var simple_string_serialized = bsonC.serialize(doc, false, true);
  assert.deepEqual(simple_string_serialized, bsonJS.serialize(doc, false, true));
  assert.deepEqual(bsonJS.deserialize(new Buffer(simple_string_serialized, 'binary')), bsonC.deserialize(simple_string_serialized));
  test.done();
}

/**
 * @ignore
 */
exports['Simple serialization and deserialization for a boolean value'] = function(test) {
  var doc = {doc:true};
  var simple_string_serialized = bsonC.serialize(doc, false, true);
  assert.deepEqual(simple_string_serialized, bsonJS.serialize(doc, false, true));
  assert.deepEqual(bsonJS.deserialize(new Buffer(simple_string_serialized, 'binary')), bsonC.deserialize(simple_string_serialized));
  test.done();
}

/**
 * @ignore
 */
exports['Simple serialization and deserialization for a date value'] = function(test) {
  var date = new Date();
  var doc = {doc:date};
  var simple_string_serialized = bsonC.serialize(doc, false, true);
  assert.deepEqual(simple_string_serialized, bsonJS.serialize(doc, false, true));
  assert.deepEqual(bsonJS.deserialize(new Buffer(simple_string_serialized, 'binary')), bsonC.deserialize(simple_string_serialized));
  test.done();
}

/**
 * @ignore
 */
exports['Simple serialization and deserialization for a boolean value'] = function(test) {
  var doc = {doc:/abcd/mi};
  var simple_string_serialized = bsonC.serialize(doc, false, true);
  assert.deepEqual(simple_string_serialized, bsonJS.serialize(doc, false, true));
  assert.equal(bsonJS.deserialize(new Buffer(simple_string_serialized, 'binary')).doc.toString(), bsonC.deserialize(simple_string_serialized).doc.toString());

  var doc = {doc:/abcd/};
  var simple_string_serialized = bsonC.serialize(doc, false, true);
  assert.deepEqual(simple_string_serialized, bsonJS.serialize(doc, false, true));
  assert.equal(bsonJS.deserialize(new Buffer(simple_string_serialized, 'binary')).doc.toString(), bsonC.deserialize(simple_string_serialized).doc.toString());
  test.done();
}

/**
 * @ignore
 */
exports['Simple serialization and deserialization for a objectId value'] = function(test) {
  var doc = {doc:new ObjectID()};
  var simple_string_serialized = bsonC.serialize(doc, false, true);
  var doc2 = {doc:ObjectID.createFromHexString(doc.doc.toHexString())};

  assert.deepEqual(simple_string_serialized, bsonJS.serialize(doc2, false, true));
  assert.deepEqual(bsonJS.deserialize(new Buffer(simple_string_serialized, 'binary')).doc.toString(), bsonC.deserialize(simple_string_serialized).doc.toString());
  test.done();
}

/**
 * @ignore
 */
exports['Simple serialization and deserialization for a Binary value'] = function(test) {
  var binary = new Binary();
  var string = 'binstring'
  for(var index = 0; index < string.length; index++) { binary.put(string.charAt(index)); }

  var simple_string_serialized = bsonC.serialize({doc:binary}, false, true);
  assert.deepEqual(simple_string_serialized, bsonJS.serialize({doc:binary}, false, true));
  assert.deepEqual(bsonJS.deserialize(new Buffer(simple_string_serialized, 'binary')).doc.value(), bsonC.deserialize(simple_string_serialized).doc.value());
  test.done();
}

/**
 * @ignore
 */
exports['Simple serialization and deserialization for a Binary value of type 2'] = function(test) {
  var binary = new Binary(new Buffer('binstring'), Binary.SUBTYPE_BYTE_ARRAY);
  var simple_string_serialized = bsonC.serialize({doc:binary}, false, true);
  assert.deepEqual(simple_string_serialized, bsonJS.serialize({doc:binary}, false, true));
  assert.deepEqual(bsonJS.deserialize(new Buffer(simple_string_serialized, 'binary')).doc.value(), bsonC.deserialize(simple_string_serialized).doc.value());
  test.done();
}

/**
 * @ignore
 */
exports['Simple serialization and deserialization for a Code value'] = function(test) {
  var code = new Code('this.a > i', {'i': 1});
  var simple_string_serialized_2 = bsonJS.serialize({doc:code}, false, true);
  var simple_string_serialized = bsonC.serialize({doc:code}, false, true);

  assert.deepEqual(simple_string_serialized, simple_string_serialized_2);
  assert.deepEqual(bsonJS.deserialize(new Buffer(simple_string_serialized_2, 'binary')).doc.scope, bsonC.deserialize(simple_string_serialized).doc.scope);
  test.done();
}

/**
 * @ignore
 */
exports['Simple serialization and deserialization for an Object'] = function(test) {
  var simple_string_serialized = bsonC.serialize({doc:{a:1, b:{c:2}}}, false, true);
  var simple_string_serialized_2 = bsonJS.serialize({doc:{a:1, b:{c:2}}}, false, true);
  assert.deepEqual(simple_string_serialized, simple_string_serialized_2)
  assert.deepEqual(bsonJS.deserialize(new Buffer(simple_string_serialized_2, 'binary')).doc, bsonC.deserialize(simple_string_serialized).doc);

  // Simple serialization and deserialization for an Array
  var simple_string_serialized = bsonC.serialize({doc:[9, 9, 1, 2, 3, 1, 1, 1, 1, 1, 1, 1]}, false, true);
  var simple_string_serialized_2 = bsonJS.serialize({doc:[9, 9, 1, 2, 3, 1, 1, 1, 1, 1, 1, 1]}, false, true);

  assert.deepEqual(simple_string_serialized, simple_string_serialized_2)
  assert.deepEqual(bsonJS.deserialize(new Buffer(simple_string_serialized_2, 'binary')).doc, bsonC.deserialize(simple_string_serialized).doc);
  test.done();
}

/**
 * @ignore
 */
exports['Simple serialization and deserialization for a DBRef'] = function(test) {
  var oid = new ObjectID()
  var oid2 = new ObjectID.createFromHexString(oid.toHexString())
  var simple_string_serialized = bsonJS.serialize({doc:new DBRef('namespace', oid2, 'integration_tests_')}, false, true);
  var simple_string_serialized_2 = bsonC.serialize({doc:new DBRef('namespace', oid, 'integration_tests_')}, false, true);

  assert.deepEqual(simple_string_serialized, simple_string_serialized_2)
  // Ensure we have the same values for the dbref
  var object_js = bsonJS.deserialize(new Buffer(simple_string_serialized_2, 'binary'));
  var object_c = bsonC.deserialize(simple_string_serialized);

  assert.equal(object_js.doc.namespace, object_c.doc.namespace);
  assert.equal(object_js.doc.oid.toHexString(), object_c.doc.oid.toHexString());
  assert.equal(object_js.doc.db, object_c.doc.db);
  test.done();
}

/**
 * @ignore
 */
exports['Should correctly deserialize bytes array'] = function(test) {
  // Serialized document
  var bytes = [47,0,0,0,2,110,97,109,101,0,6,0,0,0,80,97,116,116,121,0,16,97,103,101,0,34,0,0,0,7,95,105,100,0,76,100,12,23,11,30,39,8,89,0,0,1,0];
  var serialized_data = '';
  // Convert to chars
  for(var i = 0; i < bytes.length; i++) {
    serialized_data = serialized_data + BinaryParser.fromByte(bytes[i]);
  }
  var object = bsonC.deserialize(new Buffer(serialized_data, 'binary'));
  assert.equal('Patty', object.name)
  assert.equal(34, object.age)
  assert.equal('4c640c170b1e270859000001', object._id.toHexString())
  test.done();
}

/**
 * @ignore
 */
exports['Serialize utf8'] = function(test) {
  var doc = { "name" : "本荘由利地域に洪水警報", "name1" : "öüóőúéáűíÖÜÓŐÚÉÁŰÍ", "name2" : "abcdedede"};
  var simple_string_serialized = bsonC.serialize(doc, false, true);
  var simple_string_serialized2 = bsonJS.serialize(doc, false, true);
  assert.deepEqual(simple_string_serialized, simple_string_serialized2)

  var object = bsonC.deserialize(simple_string_serialized);
  assert.equal(doc.name, object.name)
  assert.equal(doc.name1, object.name1)
  assert.equal(doc.name2, object.name2)
  test.done();
}

/**
 * @ignore
 */
exports['Serialize object with array'] = function(test) {
  var doc = {b:[1, 2, 3]};
  var simple_string_serialized = bsonC.serialize(doc, false, true);
  var simple_string_serialized_2 = bsonJS.serialize(doc, false, true);
  assert.deepEqual(simple_string_serialized, simple_string_serialized_2)

  var object = bsonC.deserialize(simple_string_serialized);
  assert.deepEqual(doc, object)
  test.done();
}

/**
 * @ignore
 */
exports['Test equality of an object ID'] = function(test) {
  var object_id = new ObjectID();
  var object_id_2 = new ObjectID();
  assert.ok(object_id.equals(object_id));
  assert.ok(!(object_id.equals(object_id_2)))
  test.done();
}

/**
 * @ignore
 */
exports['Test same serialization for Object ID'] = function(test) {
  var object_id = new ObjectID();
  var object_id2 = ObjectID.createFromHexString(object_id.toString())
  var simple_string_serialized = bsonJS.serialize({doc:object_id}, false, true);
  var simple_string_serialized_2 = bsonC.serialize({doc:object_id2}, false, true);

  assert.equal(simple_string_serialized_2.length, simple_string_serialized.length);
  assert.deepEqual(simple_string_serialized, simple_string_serialized_2)
  var object = bsonJS.deserialize(new Buffer(simple_string_serialized_2, 'binary'));
  var object2 = bsonC.deserialize(simple_string_serialized);
  assert.equal(object.doc.id, object2.doc.id)
  test.done();
}

/**
 * @ignore
 */
exports['Complex object serialization'] = function(test) {
  // JS Object
  var c1 = { _id: new ObjectID, comments: [], title: 'number 1' };
  var c2 = { _id: new ObjectID, comments: [], title: 'number 2' };
  var doc = {
      numbers: []
    , owners: []
    , comments: [c1, c2]
    , _id: new ObjectID
  };

  var simple_string_serialized = bsonJS.serialize(doc, false, true);

  // C++ Object
  var c1 = { _id: ObjectID.createFromHexString(c1._id.toHexString()), comments: [], title: 'number 1' };
  var c2 = { _id: ObjectID.createFromHexString(c2._id.toHexString()), comments: [], title: 'number 2' };
  var doc = {
      numbers: []
    , owners: []
    , comments: [c1, c2]
    , _id: ObjectID.createFromHexString(doc._id.toHexString())
  };

  var simple_string_serialized_2 = bsonC.serialize(doc, false, true);

  for(var i = 0; i < simple_string_serialized_2.length; i++) {
    // debug(i + "[" + simple_string_serialized_2[i] + "] = [" + simple_string_serialized[i] + "]")
    assert.equal(simple_string_serialized_2[i], simple_string_serialized[i]);
  }

  var doc1 = bsonJS.deserialize(new Buffer(simple_string_serialized_2));
  var doc2 = bsonC.deserialize(new Buffer(simple_string_serialized_2));
  assert.equal(doc._id.id, doc1._id.id)
  assert.equal(doc._id.id, doc2._id.id)
  assert.equal(doc1._id.id, doc2._id.id)

  var doc = {
   _id: 'testid',
    key1: { code: 'test1', time: {start:1309323402727,end:1309323402727}, x:10, y:5 },
    key2: { code: 'test1', time: {start:1309323402727,end:1309323402727}, x:10, y:5 }
  };

  var simple_string_serialized = bsonJS.serialize(doc, false, true);
  var simple_string_serialized_2 = bsonC.serialize(doc, false, true);
  test.done();
}

/**
 * @ignore
 */
exports['Serialize function'] = function(test) {
  var doc = {
   _id: 'testid',
    key1: function() {}
  }

  var simple_string_serialized = bsonJS.serialize(doc, false, true, true);
  var simple_string_serialized_2 = bsonC.serialize(doc, false, true, true);

  // Deserialize the string
  var doc1 = bsonJS.deserialize(new Buffer(simple_string_serialized_2));
  var doc2 = bsonC.deserialize(new Buffer(simple_string_serialized_2));
  assert.equal(doc1.key1.code.toString(), doc2.key1.code.toString())
  test.done();
}

/**
 * @ignore
 */
exports['Serialize document with special operators'] = function(test) {
  var doc =  {"user_id":"4e9fc8d55883d90100000003","lc_status":{"$ne":"deleted"},"owner_rating":{"$exists":false}};
  var simple_string_serialized = bsonJS.serialize(doc, false, true, true);
  var simple_string_serialized_2 = bsonC.serialize(doc, false, true, true);

  // Should serialize to the same value
  assert.equal(simple_string_serialized_2.toString('base64'), simple_string_serialized.toString('base64'))
  var doc1 = bsonJS.deserialize(simple_string_serialized_2);
  var doc2 = bsonC.deserialize(simple_string_serialized);
  assert.deepEqual(doc1, doc2)
  test.done();
}

/**
 * @ignore
 */
exports['Create ObjectID from hex string'] = function(test) {
  // Hex Id
  var hexId = new ObjectID().toString();
  var docJS = {_id: ObjectID.createFromHexString(hexId), 'funds.remaining': {$gte: 1.222}, 'transactions.id': {$ne: ObjectID.createFromHexString(hexId)}};
  var docC = {_id: ObjectID.createFromHexString(hexId), 'funds.remaining': {$gte: 1.222}, 'transactions.id': {$ne: ObjectID.createFromHexString(hexId)}};
  var docJSBin = bsonJS.serialize(docJS, false, true, true);
  var docCBin = bsonC.serialize(docC, false, true, true);
  assert.equal(docCBin.toString('base64'), docJSBin.toString('base64'));
  test.done();
}

/**
 * @ignore
 */
exports['Serialize big complex document'] = function(test) {
  // Complex document serialization
  var doc = {"DateTime": "Tue Nov 40 2011 17:27:55 GMT+0000 (WEST)","isActive": true,"Media": {"URL": "http://videos.sapo.pt/Tc85NsjaKjj8o5aV7Ubb"},"Title": "Lisboa fecha a ganhar 0.19%","SetPosition": 60,"Type": "videos","Thumbnail": [{"URL": "http://rd3.videos.sapo.pt/Tc85NsjaKjj8o5aV7Ubb/pic/320x240","Dimensions": {"Height": 240,"Width": 320}}],"Source": {"URL": "http://videos.sapo.pt","SetID": "1288","SourceID": "http://videos.sapo.pt/tvnet/rss2","SetURL": "http://noticias.sapo.pt/videos/tv-net_1288/","ItemID": "Tc85NsjaKjj8o5aV7Ubb","Name": "SAPO VÃ­deos"},"Category": "Tec_ciencia","Description": "Lisboa fecha a ganhar 0.19%","GalleryID": new ObjectID("4eea2a634ce8573200000000"),"InternalRefs": {"RegisterDate": "Thu Dec 15 2011 17:12:51 GMT+0000 (WEST)","ChangeDate": "Thu Dec 15 2011 17:12:51 GMT+0000 (WEST)","Hash": 332279244514},"_id": new ObjectID("4eea2a96e52778160000003a")}
  var docJSBin = bsonJS.serialize(doc, false, true, true);
  var docCBin = bsonC.serialize(doc, false, true, true);
  assert.equal(docCBin.toString('base64'), docJSBin.toString('base64'));
  test.done();
}

/**
 * @ignore
 */
exports['Should error out due to 24 characters but not valid hexstring for ObjectID'] = function(test) {
  try {
    var oid = new ObjectID("tttttttttttttttttttttttt");
    test.ok(false);
  } catch(err) {}

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