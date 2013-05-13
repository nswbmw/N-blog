var Long = require('bson').Long
  , timers = require('timers');

// Set processor, setImmediate if 0.10 otherwise nextTick
var processor = timers.setImmediate ? timers.setImmediate : process.nextTick;

/**
  Reply message from mongo db
**/
var MongoReply = exports.MongoReply = function() {
  this.documents = [];
  this.index = 0;
};

MongoReply.prototype.parseHeader = function(binary_reply, bson) {
  // Unpack the standard header first
  this.messageLength = binary_reply[this.index] | binary_reply[this.index + 1] << 8 | binary_reply[this.index + 2] << 16 | binary_reply[this.index + 3] << 24;
  this.index = this.index + 4;
  // Fetch the request id for this reply
  this.requestId = binary_reply[this.index] | binary_reply[this.index + 1] << 8 | binary_reply[this.index + 2] << 16 | binary_reply[this.index + 3] << 24;
  this.index = this.index + 4;
  // Fetch the id of the request that triggered the response
  this.responseTo = binary_reply[this.index] | binary_reply[this.index + 1] << 8 | binary_reply[this.index + 2] << 16 | binary_reply[this.index + 3] << 24;
  // Skip op-code field
  this.index = this.index + 4 + 4;
  // Unpack the reply message
  this.responseFlag = binary_reply[this.index] | binary_reply[this.index + 1] << 8 | binary_reply[this.index + 2] << 16 | binary_reply[this.index + 3] << 24;
  this.index = this.index + 4;
  // Unpack the cursor id (a 64 bit long integer)
  var low_bits = binary_reply[this.index] | binary_reply[this.index + 1] << 8 | binary_reply[this.index + 2] << 16 | binary_reply[this.index + 3] << 24;
  this.index = this.index + 4;
  var high_bits = binary_reply[this.index] | binary_reply[this.index + 1] << 8 | binary_reply[this.index + 2] << 16 | binary_reply[this.index + 3] << 24;
  this.index = this.index + 4;
  this.cursorId = new Long(low_bits, high_bits);
  // Unpack the starting from
  this.startingFrom = binary_reply[this.index] | binary_reply[this.index + 1] << 8 | binary_reply[this.index + 2] << 16 | binary_reply[this.index + 3] << 24;
  this.index = this.index + 4;
  // Unpack the number of objects returned
  this.numberReturned = binary_reply[this.index] | binary_reply[this.index + 1] << 8 | binary_reply[this.index + 2] << 16 | binary_reply[this.index + 3] << 24;
  this.index = this.index + 4;
}

MongoReply.prototype.parseBody = function(binary_reply, bson, raw, callback) {
  raw = raw == null ? false : raw;
  // Just set a doc limit for deserializing
  var docLimitSize = 1024*20;

  // If our message length is very long, let's switch to process.nextTick for messages
  if(this.messageLength > docLimitSize) {
    var batchSize = this.numberReturned;
    this.documents = new Array(this.numberReturned);

    // Just walk down until we get a positive number >= 1
    for(var i = 50; i > 0; i--) {
      if((this.numberReturned/i) >= 1) {
        batchSize = i;
        break;
      }
    }

    // Actual main creator of the processFunction setting internal state to control the flow
    var parseFunction = function(_self, _binary_reply, _batchSize, _numberReturned) {
      var object_index = 0;
      // Internal loop process that will use nextTick to ensure we yield some time
      var processFunction = function() {
        // Adjust batchSize if we have less results left than batchsize
        if((_numberReturned - object_index) < _batchSize) {
          _batchSize = _numberReturned - object_index;
        }

        // If raw just process the entries
        if(raw) {
          // Iterate over the batch
          for(var i = 0; i < _batchSize; i++) {
            // Are we done ?
            if(object_index <= _numberReturned) {
              // Read the size of the bson object
              var bsonObjectSize = _binary_reply[_self.index] | _binary_reply[_self.index + 1] << 8 | _binary_reply[_self.index + 2] << 16 | _binary_reply[_self.index + 3] << 24;
              // If we are storing the raw responses to pipe straight through
              _self.documents[object_index] = binary_reply.slice(_self.index, _self.index + bsonObjectSize);
              // Adjust binary index to point to next block of binary bson data
              _self.index = _self.index + bsonObjectSize;
              // Update number of docs parsed
              object_index = object_index + 1;
            }
          }
        } else {
          try {
            // Parse documents
            _self.index = bson.deserializeStream(binary_reply, _self.index, _batchSize, _self.documents, object_index);
            // Adjust index
            object_index = object_index + _batchSize;
          } catch (err) {
            return callback(err);
          }
        }

        // If we have more documents process NextTick
        if(object_index < _numberReturned) {
          processor(processFunction);
        } else {
          callback(null);
        }
      }

      // Return the process function
      return processFunction;
    }(this, binary_reply, batchSize, this.numberReturned)();
  } else {
    try {
      // Let's unpack all the bson documents, deserialize them and store them
      for(var object_index = 0; object_index < this.numberReturned; object_index++) {
        // Read the size of the bson object
        var bsonObjectSize = binary_reply[this.index] | binary_reply[this.index + 1] << 8 | binary_reply[this.index + 2] << 16 | binary_reply[this.index + 3] << 24;
        // If we are storing the raw responses to pipe straight through
        if(raw) {
          // Deserialize the object and add to the documents array
          this.documents.push(binary_reply.slice(this.index, this.index + bsonObjectSize));
        } else {
          // Deserialize the object and add to the documents array
          this.documents.push(bson.deserialize(binary_reply.slice(this.index, this.index + bsonObjectSize)));
        }
        // Adjust binary index to point to next block of binary bson data
        this.index = this.index + bsonObjectSize;
      }
    } catch(err) {
      return callback(err);
    }

    // No error return
    callback(null);
  }
}

MongoReply.prototype.is_error = function(){
  if(this.documents.length == 1) {
    return this.documents[0].ok == 1 ? false : true;
  }
  return false;
};

MongoReply.prototype.error_message = function() {
  return this.documents.length == 1 && this.documents[0].ok == 1 ? '' : this.documents[0].errmsg;
};