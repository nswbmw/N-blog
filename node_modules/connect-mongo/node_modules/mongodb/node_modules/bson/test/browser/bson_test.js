this.bson_test = {
    'Full document serialization and deserialization': function (test) {
      var motherOfAllDocuments = {
        'string': "客家话",
        'array': [1,2,3],
        'hash': {'a':1, 'b':2},
        'date': new Date(),
        'oid': new ObjectID(),
        'binary': new Binary('hello world'),
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
      var data = BSON.serialize(motherOfAllDocuments, true, true, false);
      // Deserialize the object
      var object = BSON.deserialize(data);
    
      // Asserts
      test.equal(Utf8.decode(motherOfAllDocuments.string), object.string);
      test.deepEqual(motherOfAllDocuments.array, object.array);
      test.deepEqual(motherOfAllDocuments.date, object.date);
      test.deepEqual(motherOfAllDocuments.oid.toHexString(), object.oid.toHexString());
      test.deepEqual(motherOfAllDocuments.binary.length(), object.binary.length());    
      test.ok(assertArrayEqual(motherOfAllDocuments.binary.value(true), object.binary.value(true)));
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
    },
    
    'exercise all the binary object constructor methods': function (test) {
      // Construct using array
      var string = 'hello world';
      // String to array
      var array = stringToArrayBuffer(string);

      // Binary from array buffer
      var binary = new Binary(stringToArrayBuffer(string));
      test.ok(string.length, binary.buffer.length);
      test.ok(assertArrayEqual(array, binary.buffer));
      
      // Construct using number of chars
      binary = new Binary(5);
      test.ok(5, binary.buffer.length);
      
      // Construct using an Array
      var binary = new Binary(stringToArray(string));
      test.ok(string.length, binary.buffer.length);
      test.ok(assertArrayEqual(array, binary.buffer));
      
      // Construct using a string
      var binary = new Binary(string);
      test.ok(string.length, binary.buffer.length);
      test.ok(assertArrayEqual(array, binary.buffer));
      test.done();
    },

    'exercise the put binary object method for an instance when using Uint8Array': function (test) {
      // Construct using array
      var string = 'hello world';
      // String to array
      var array = stringToArrayBuffer(string + 'a');
      
      // Binary from array buffer
      var binary = new Binary(stringToArrayBuffer(string));
      test.ok(string.length, binary.buffer.length);
    
      // Write a byte to the array
      binary.put('a')
    
      // Verify that the data was writtencorrectly
      test.equal(string.length + 1, binary.position);
      test.ok(assertArrayEqual(array, binary.value(true)));
      test.equal('hello worlda', binary.value());
    
      // Exercise a binary with lots of space in the buffer
      var binary = new Binary();
      test.ok(Binary.BUFFER_SIZE, binary.buffer.length);
    
      // Write a byte to the array
      binary.put('a')
    
      // Verify that the data was writtencorrectly
      test.equal(1, binary.position);
      test.ok(assertArrayEqual(['a'.charCodeAt(0)], binary.value(true)));
      test.equal('a', binary.value());
      test.done();
    },
    
    'exercise the write binary object method for an instance when using Uint8Array': function (test) {
      // Construct using array
      var string = 'hello world';
      // Array
      var writeArrayBuffer = new Uint8Array(new ArrayBuffer(1));
      writeArrayBuffer[0] = 'a'.charCodeAt(0);
      var arrayBuffer = ['a'.charCodeAt(0)];
      
      // Binary from array buffer
      var binary = new Binary(stringToArrayBuffer(string));
      test.ok(string.length, binary.buffer.length);
    
      // Write a string starting at end of buffer
      binary.write('a');
      test.equal('hello worlda', binary.value());
      // Write a string starting at index 0
      binary.write('a', 0);
      test.equal('aello worlda', binary.value());
      // Write a arraybuffer starting at end of buffer
      binary.write(writeArrayBuffer);
      test.equal('aello worldaa', binary.value());
      // Write a arraybuffer starting at position 5
      binary.write(writeArrayBuffer, 5);
      test.equal('aelloaworldaa', binary.value());
      // Write a array starting at end of buffer
      binary.write(arrayBuffer);
      test.equal('aelloaworldaaa', binary.value());
      // Write a array starting at position 6
      binary.write(arrayBuffer, 6);
      test.equal('aelloaaorldaaa', binary.value());
      test.done();
    },
    
    'exercise the read binary object method for an instance when using Uint8Array': function (test) {      
      // Construct using array
      var string = 'hello world';
      var array = stringToArrayBuffer(string);
    
      // Binary from array buffer
      var binary = new Binary(stringToArrayBuffer(string));
      test.ok(string.length, binary.buffer.length);
      
      // Read the first 2 bytes
      var data = binary.read(0, 2);
      test.ok(assertArrayEqual(stringToArrayBuffer('he'), data));
    
      // Read the entire field
      var data = binary.read(0);
      test.ok(assertArrayEqual(stringToArrayBuffer(string), data));
    
      // Read 3 bytes
      var data = binary.read(6, 5);
      test.ok(assertArrayEqual(stringToArrayBuffer('world'), data));
      test.done();
    },

		'Should correctly handle toBson function for an object': function(test) {
			// Test object
			var doc = {
				hello: new ObjectID(),
				a:1
			};
			// Add a toBson method to the object
			doc.toBSON = function() {
				return {b:1};
			}

			// Serialize the data		
			var serialized_data = BSON.serialize(doc, false, true);
			var deserialized_doc = BSON.deserialize(serialized_data);	
			test.equal(1, deserialized_doc.b);
		  test.done();			
		}
};

var assertArrayEqual = function(array1, array2) {
  if(array1.length != array2.length) return false;
  for(var i = 0; i < array1.length; i++) {
    if(array1[i] != array2[i]) return false;
  }
  
  return true;
}

// String to arraybuffer
var stringToArrayBuffer = function(string) {
  var dataBuffer = new Uint8Array(new ArrayBuffer(string.length));
  // Return the strings
  for(var i = 0; i < string.length; i++) {
    dataBuffer[i] = string.charCodeAt(i);
  }
  // Return the data buffer
  return dataBuffer;
}

// String to arraybuffer
var stringToArray = function(string) {
  var dataBuffer = new Array(string.length);
  // Return the strings
  for(var i = 0; i < string.length; i++) {
    dataBuffer[i] = string.charCodeAt(i);
  }
  // Return the data buffer
  return dataBuffer;
}

var Utf8 = {
	// public method for url encoding
	encode : function (string) {
		string = string.replace(/\r\n/g,"\n");
		var utftext = "";
 
		for (var n = 0; n < string.length; n++) {
			var c = string.charCodeAt(n);
			if (c < 128) {
				utftext += String.fromCharCode(c);
			} else if((c > 127) && (c < 2048)) {
				utftext += String.fromCharCode((c >> 6) | 192);
				utftext += String.fromCharCode((c & 63) | 128);
			} else {
				utftext += String.fromCharCode((c >> 12) | 224);
				utftext += String.fromCharCode(((c >> 6) & 63) | 128);
				utftext += String.fromCharCode((c & 63) | 128);
			}
 
		}
 
		return utftext;
	},
 
	// public method for url decoding
	decode : function (utftext) {
		var string = "";
		var i = 0;
		var c = c1 = c2 = 0;
 
		while ( i < utftext.length ) {
			c = utftext.charCodeAt(i); 
			if(c < 128) {
				string += String.fromCharCode(c);
				i++;
			} else if((c > 191) && (c < 224)) {
				c2 = utftext.charCodeAt(i+1);
				string += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
				i += 2;
			} else {
				c2 = utftext.charCodeAt(i+1);
				c3 = utftext.charCodeAt(i+2);
				string += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
				i += 3;
			} 
		} 
		return string;
	} 
}
