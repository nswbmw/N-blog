var Connection = require('./connection').Connection,
  ReadPreference = require('./read_preference').ReadPreference,
  DbCommand = require('../commands/db_command').DbCommand,
  MongoReply = require('../responses/mongo_reply').MongoReply,
  ConnectionPool = require('./connection_pool').ConnectionPool,
  EventEmitter = require('events').EventEmitter,
  Base = require('./base').Base,
  utils = require('../utils'),
  timers = require('timers'),
  inherits = require('util').inherits;

// Set processor, setImmediate if 0.10 otherwise nextTick
var processor = timers.setImmediate ? timers.setImmediate : process.nextTick;
processor = process.nextTick

/**
 * Class representing a single MongoDB Server connection
 *
 * Options
 *  - **readPreference** {String, default:null}, set's the read preference (ReadPreference.PRIMARY, ReadPreference.PRIMARY_PREFERRED, ReadPreference.SECONDARY, ReadPreference.SECONDARY_PREFERRED, ReadPreference.NEAREST)
 *  - **ssl** {Boolean, default:false}, use ssl connection (needs to have a mongod server with ssl support)
 *  - **sslValidate** {Boolean, default:false}, validate mongod server certificate against ca (needs to have a mongod server with ssl support, 2.4 or higher)
 *  - **sslCA** {Array, default:null}, Array of valid certificates either as Buffers or Strings (needs to have a mongod server with ssl support, 2.4 or higher)
 *  - **sslCert** {Buffer/String, default:null}, String or buffer containing the certificate we wish to present (needs to have a mongod server with ssl support, 2.4 or higher)
 *  - **sslKey** {Buffer/String, default:null}, String or buffer containing the certificate private key we wish to present (needs to have a mongod server with ssl support, 2.4 or higher)
 *  - **sslPass** {Buffer/String, default:null}, String or buffer containing the certificate password (needs to have a mongod server with ssl support, 2.4 or higher)
 *  - **poolSize** {Number, default:5}, number of connections in the connection pool, set to 5 as default for legacy reasons.
 *  - **socketOptions** {Object, default:null}, an object containing socket options to use (noDelay:(boolean), keepAlive:(number), connectTimeoutMS:(number), socketTimeoutMS:(number))
 *  - **logger** {Object, default:null}, an object representing a logger that you want to use, needs to support functions debug, log, error **({error:function(message, object) {}, log:function(message, object) {}, debug:function(message, object) {}})**.
 *  - **auto_reconnect** {Boolean, default:false}, reconnect on error.
 *  - **disableDriverBSONSizeCheck** {Boolean, default:false}, force the server to error if the BSON message is to big
 *
 * @class Represents a Server connection.
 * @param {String} host the server host
 * @param {Number} port the server port
 * @param {Object} [options] optional options for insert command
 */
function Server(host, port, options) {
  // Set up Server instance
  if(!(this instanceof Server)) return new Server(host, port, options);

  // Set up event emitter
  Base.call(this);

  // Ensure correct values
  if(port != null && typeof port == 'object') {
    options = port;
    port = Connection.DEFAULT_PORT;
  }

  var self = this;
  this.host = host;
  this.port = port;
  this.options = options == null ? {} : options;
  this.internalConnection;
  this.internalMaster = false;
  this.connected = false;
  this.poolSize = this.options.poolSize == null ? 5 : this.options.poolSize;
  this.disableDriverBSONSizeCheck = this.options.disableDriverBSONSizeCheck != null ? this.options.disableDriverBSONSizeCheck : false;
  this.slaveOk = this.options["slave_ok"] ? this.options["slave_ok"] : this.options["slaveOk"];
  this._used = false;
  this.replicasetInstance = null;

  // Set ssl as connection method
  this.ssl = this.options.ssl == null ? false : this.options.ssl;
  // Set ssl validation
  this.sslValidate = this.options.sslValidate == null ? false : this.options.sslValidate;
  // Set the ssl certificate authority (array of Buffer/String keys)
  this.sslCA = Array.isArray(this.options.sslCA) ? this.options.sslCA : null;
  // Certificate to present to the server
  this.sslCert = this.options.sslCert;
  // Certificate private key if in separate file
  this.sslKey = this.options.sslKey;
  // Password to unlock private key
  this.sslPass = this.options.sslPass;

  // Ensure we are not trying to validate with no list of certificates
  if(this.sslValidate && (!Array.isArray(this.sslCA) || this.sslCA.length == 0)) {
    throw new Error("The driver expects an Array of CA certificates in the sslCA parameter when enabling sslValidate");
  }

  // Get the readPreference
  var readPreference = this.options['readPreference'];
  // If readPreference is an object get the mode string
  var validateReadPreference = readPreference != null && typeof readPreference == 'object' ? readPreference.mode : readPreference;
  // Read preference setting
  if(validateReadPreference != null) {
    if(validateReadPreference != ReadPreference.PRIMARY && validateReadPreference != ReadPreference.SECONDARY && validateReadPreference != ReadPreference.NEAREST
      && validateReadPreference != ReadPreference.SECONDARY_PREFERRED && validateReadPreference != ReadPreference.PRIMARY_PREFERRED) {
        throw new Error("Illegal readPreference mode specified, " + validateReadPreference);
    }

    // Set read Preference
    this._readPreference = readPreference;
  } else {
    this._readPreference = null;
  }

  // Contains the isMaster information returned from the server
  this.isMasterDoc;

  // Set default connection pool options
  this.socketOptions = this.options.socketOptions != null ? this.options.socketOptions : {};
  if(this.disableDriverBSONSizeCheck) this.socketOptions.disableDriverBSONSizeCheck = this.disableDriverBSONSizeCheck;

  // Set ssl up if it's defined
  if(this.ssl) {
    this.socketOptions.ssl = true;
    // Set ssl validation
    this.socketOptions.sslValidate = this.sslValidate == null ? false : this.sslValidate;
    // Set the ssl certificate authority (array of Buffer/String keys)
    this.socketOptions.sslCA = Array.isArray(this.sslCA) ? this.sslCA : null;
    // Set certificate to present
    this.socketOptions.sslCert = this.sslCert;
    // Set certificate to present
    this.socketOptions.sslKey = this.sslKey;
    // Password to unlock private key
    this.socketOptions.sslPass = this.sslPass;
  }

  // Set up logger if any set
  this.logger = this.options.logger != null
    && (typeof this.options.logger.debug == 'function')
    && (typeof this.options.logger.error == 'function')
    && (typeof this.options.logger.log == 'function')
      ? this.options.logger : {error:function(message, object) {}, log:function(message, object) {}, debug:function(message, object) {}};

  // Just keeps list of events we allow
  this.eventHandlers = {error:[], parseError:[], poolReady:[], message:[], close:[], timeout:[]};
  // Internal state of server connection
  this._serverState = 'disconnected';
  // this._timeout = false;
  // Contains state information about server connection
  this._state = {'runtimeStats': {'queryStats':new RunningStats()}};
  // Do we record server stats or not
  this.recordQueryStats = false;
};

/**
 * @ignore
 */
inherits(Server, Base);

//
//  Deprecated, USE ReadPreferences class
//
Server.READ_PRIMARY = ReadPreference.PRIMARY;
Server.READ_SECONDARY = ReadPreference.SECONDARY_PREFERRED;
Server.READ_SECONDARY_ONLY = ReadPreference.SECONDARY;

/**
 * Always ourselves
 * @ignore
 */
Server.prototype.setReadPreference = function() {}

/**
 * @ignore
 */
Server.prototype.isMongos = function() {
  return this.isMasterDoc != null && this.isMasterDoc['msg'] == "isdbgrid" ? true : false;
}

/**
 * @ignore
 */
Server.prototype._isUsed = function() {
  return this._used;
}

/**
 * @ignore
 */
Server.prototype.close = function(callback) {
  // Remove all local listeners
  this.removeAllListeners();

  if(this.connectionPool != null) {
    // Remove all the listeners on the pool so it does not fire messages all over the place
    this.connectionPool.removeAllEventListeners();
    // Close the connection if it's open
    this.connectionPool.stop(true);
  }

  // Set server status as disconnected
  this._serverState = 'disconnected';
  // Peform callback if present
  if(typeof callback === 'function') callback(null);
};

/**
 * @ignore
 */
Server.prototype.isConnected = function() {
  return this._serverState == 'connected';
}

/**
 * @ignore
 */
Server.prototype.allServerInstances = function() {
  return [this];
}

/**
 * @ignore
 */
Server.prototype.isSetMember = function() {
  return this.replicasetInstance != null || this.mongosInstance != null;
}

/**
 * Assigns a replica set to this `server`.
 *
 * @param {ReplSet} replset
 * @ignore
 */
Server.prototype.assignReplicaSet = function (replset) {
  this.replicasetInstance = replset;
  this.inheritReplSetOptionsFrom(replset);
  this.enableRecordQueryStats(replset.recordQueryStats);
}

/**
 * Takes needed options from `replset` and overwrites
 * our own options.
 *
 * @param {ReplSet} replset
 * @ignore
 */
Server.prototype.inheritReplSetOptionsFrom = function (replset) {
  this.socketOptions = {};
  this.socketOptions.connectTimeoutMS = replset._connectTimeoutMS;

  if(replset.ssl) {
    // Set ssl on
    this.socketOptions.ssl = true;
    // Set ssl validation
    this.socketOptions.sslValidate = replset.sslValidate == null ? false : replset.sslValidate;
    // Set the ssl certificate authority (array of Buffer/String keys)
    this.socketOptions.sslCA = Array.isArray(replset.sslCA) ? replset.sslCA : null;
    // Set certificate to present
    this.socketOptions.sslCert = replset.sslCert;
    // Set certificate to present
    this.socketOptions.sslKey = replset.sslKey;
    // Password to unlock private key
    this.socketOptions.sslPass = replset.sslPass;
  }

  // If a socket option object exists clone it
  if(utils.isObject(replset.socketOptions)) {
    var keys = Object.keys(replset.socketOptions);
    for(var i = 0; i < keys.length; i++)
      this.socketOptions[keys[i]] = replset.socketOptions[keys[i]];
  }
}

/**
 * Opens this server connection.
 *
 * @ignore
 */
Server.prototype.connect = function(dbInstance, options, callback) {
  if('function' === typeof options) callback = options, options = {};
  if(options == null) options = {};
  if(!('function' === typeof callback)) callback = null;

  // Currently needed to work around problems with multiple connections in a pool with ssl
  // TODO fix if possible
  if(this.ssl == true) {
    // Set up socket options for ssl
    this.socketOptions.ssl = true;
    // Set ssl validation
    this.socketOptions.sslValidate = this.sslValidate == null ? false : this.sslValidate;
    // Set the ssl certificate authority (array of Buffer/String keys)
    this.socketOptions.sslCA = Array.isArray(this.sslCA) ? this.sslCA : null;
    // Set certificate to present
    this.socketOptions.sslCert = this.sslCert;
    // Set certificate to present
    this.socketOptions.sslKey = this.sslKey;
    // Password to unlock private key
    this.socketOptions.sslPass = this.sslPass;
  }

  // Let's connect
  var server = this;
  // Let's us override the main receiver of events
  var eventReceiver = options.eventReceiver != null ? options.eventReceiver : this;
  // Save reference to dbInstance
  this.db = dbInstance;  // `db` property matches ReplSet and Mongos
  this.dbInstances = [dbInstance];

  // Force connection pool if there is one
  if(server.connectionPool) server.connectionPool.stop();

  // Set server state to connecting
  this._serverState = 'connecting';
  // Ensure dbInstance can do a slave query if it's set
  dbInstance.slaveOk = this.slaveOk ? this.slaveOk : dbInstance.slaveOk;
  // Create connection Pool instance with the current BSON serializer
  var connectionPool = new ConnectionPool(this.host, this.port, this.poolSize, dbInstance.bson,  this.socketOptions);
  // If ssl is not enabled don't wait between the pool connections
  if(this.ssl == null || !this.ssl) connectionPool._timeToWait = null;
  // Set logger on pool
  connectionPool.logger = this.logger;

  // Set up a new pool using default settings
  server.connectionPool = connectionPool;

  // Set basic parameters passed in
  var returnIsMasterResults = options.returnIsMasterResults == null ? false : options.returnIsMasterResults;

  // Create a default connect handler, overriden when using replicasets
  var connectCallback = function(err, reply) {
    // ensure no callbacks get called twice
    var internalCallback = callback;
    callback = null;
    // If something close down the connection and removed the callback before
    // proxy killed connection etc, ignore the erorr as close event was isssued
    if(err != null && internalCallback == null) return;
    // Internal callback
    if(err != null) return internalCallback(err, null, server);
    server.master = reply.documents[0].ismaster == 1 ? true : false;
    server.connectionPool.setMaxBsonSize(reply.documents[0].maxBsonObjectSize);
    server.connectionPool.setMaxMessageSizeBytes(reply.documents[0].maxMessageSizeBytes);
    // Set server as connected
    server.connected = true;
    // Save document returned so we can query it
    server.isMasterDoc = reply.documents[0];

    // Emit open event
    _emitAcrossAllDbInstances(server, eventReceiver, "open", null, returnIsMasterResults ? reply : dbInstance, null);

    // If we have it set to returnIsMasterResults
    if(returnIsMasterResults) {
      internalCallback(null, reply, server);
    } else {
      internalCallback(null, dbInstance, server);
    }
  };

  // Let's us override the main connect callback
  var connectHandler = options.connectHandler == null ? connectCallback : options.connectHandler;

  // Set up on connect method
  connectionPool.on("poolReady", function() {
    // Create db command and Add the callback to the list of callbacks by the request id (mapping outgoing messages to correct callbacks)
    var db_command = DbCommand.NcreateIsMasterCommand(dbInstance, dbInstance.databaseName);
    // Check out a reader from the pool
    var connection = connectionPool.checkoutConnection();
    // Set server state to connEcted
    server._serverState = 'connected';

    // Register handler for messages
    server._registerHandler(db_command, false, connection, connectHandler);

    // Write the command out
    connection.write(db_command);
  })

  // Set up item connection
  connectionPool.on("message", function(message) {
    // Attempt to parse the message
    try {
      // Create a new mongo reply
      var mongoReply = new MongoReply()
      // Parse the header
      mongoReply.parseHeader(message, connectionPool.bson)

      // If message size is not the same as the buffer size
      // something went terribly wrong somewhere
      if(mongoReply.messageLength != message.length) {
        // Emit the error
        if(eventReceiver.listeners("error") && eventReceiver.listeners("error").length > 0) eventReceiver.emit("error", new Error("bson length is different from message length"), server);
        // Remove all listeners
        server.removeAllListeners();
      } else {
        var startDate = new Date().getTime();

        // Callback instance
        var callbackInfo = server._findHandler(mongoReply.responseTo.toString());

        // The command executed another request, log the handler again under that request id
        if(mongoReply.requestId > 0 && mongoReply.cursorId.toString() != "0" 
          && callbackInfo && callbackInfo.info && callbackInfo.info.exhaust) {
            server._reRegisterHandler(mongoReply.requestId, callbackInfo);
        }

        // Only execute callback if we have a caller
        // chained is for findAndModify as it does not respect write concerns
        if(callbackInfo && callbackInfo.callback && callbackInfo.info && Array.isArray(callbackInfo.info.chained)) {
          // Check if callback has already been fired (missing chain command)
          var chained = callbackInfo.info.chained;
          var numberOfFoundCallbacks = 0;
          for(var i = 0; i < chained.length; i++) {
            if(server._hasHandler(chained[i])) numberOfFoundCallbacks++;
          }

          // If we have already fired then clean up rest of chain and move on
          if(numberOfFoundCallbacks != chained.length) {
            for(var i = 0; i < chained.length; i++) {
              server._removeHandler(chained[i]);
            }

            // Just return from function
            return;
          }

          // Parse the body
          mongoReply.parseBody(message, connectionPool.bson, callbackInfo.info.raw, function(err) {
            if(err != null) {
              // If pool connection is already closed
              if(server._serverState === 'disconnected') return;
              // Set server state to disconnected
              server._serverState = 'disconnected';
              // Remove all listeners and close the connection pool
              server.removeAllListeners();
              connectionPool.stop(true);

              // If we have a callback return the error
              if(typeof callback === 'function') {
                // ensure no callbacks get called twice
                var internalCallback = callback;
                callback = null;
                // Perform callback
                internalCallback(new Error("connection closed due to parseError"), null, server);
              } else if(server.isSetMember()) {
                if(server.listeners("parseError") && server.listeners("parseError").length > 0) server.emit("parseError", new Error("connection closed due to parseError"), server);
              } else {
                if(eventReceiver.listeners("parseError") && eventReceiver.listeners("parseError").length > 0) eventReceiver.emit("parseError", new Error("connection closed due to parseError"), server);
              }

              // If we are a single server connection fire errors correctly
              if(!server.isSetMember()) {
                // Fire all callback errors
                server.__executeAllCallbacksWithError(new Error("connection closed due to parseError"));
                // Emit error
                _emitAcrossAllDbInstances(server, eventReceiver, "parseError", server, null, true);
              }
              // Short cut
              return;
            }

            // Fetch the callback
            var callbackInfo = server._findHandler(mongoReply.responseTo.toString());
            // If we have an error let's execute the callback and clean up all other
            // chained commands
            var firstResult = mongoReply && mongoReply.documents;

            // Check for an error, if we have one let's trigger the callback and clean up
            // The chained callbacks
            if(firstResult[0].err != null || firstResult[0].errmsg != null) {
              // Trigger the callback for the error
              server._callHandler(mongoReply.responseTo, mongoReply, null);
            } else {
              var chainedIds = callbackInfo.info.chained;

              if(chainedIds.length > 0 && chainedIds[chainedIds.length - 1] == mongoReply.responseTo) {
                // Cleanup all other chained calls
                chainedIds.pop();
                // Remove listeners
                for(var i = 0; i < chainedIds.length; i++) server._removeHandler(chainedIds[i]);
                // Call the handler
                server._callHandler(mongoReply.responseTo, callbackInfo.info.results.shift(), null);
              } else{
                // Add the results to all the results
                for(var i = 0; i < chainedIds.length; i++) {
                  var handler = server._findHandler(chainedIds[i]);
                  // Check if we have an object, if it's the case take the current object commands and
                  // and add this one
                  if(handler.info != null) {
                    handler.info.results = Array.isArray(callbackInfo.info.results) ? callbackInfo.info.results : [];
                    handler.info.results.push(mongoReply);
                  }
                }
              }
            }
          });
        } else if(callbackInfo && callbackInfo.callback && callbackInfo.info) {
          // Parse the body
          mongoReply.parseBody(message, connectionPool.bson, callbackInfo.info.raw, function(err) {
            if(err != null) {
              // If pool connection is already closed
              if(server._serverState === 'disconnected') return;
              // Set server state to disconnected
              server._serverState = 'disconnected';
              // Remove all listeners and close the connection pool
              server.removeAllListeners();
              connectionPool.stop(true);

              // If we have a callback return the error
              if(typeof callback === 'function') {
                // ensure no callbacks get called twice
                var internalCallback = callback;
                callback = null;
                // Perform callback
                internalCallback(new Error("connection closed due to parseError"), null, server);
              } else if(server.isSetMember()) {
                if(server.listeners("parseError") && server.listeners("parseError").length > 0) server.emit("parseError", new Error("connection closed due to parseError"), server);
              } else {
                if(eventReceiver.listeners("parseError") && eventReceiver.listeners("parseError").length > 0) eventReceiver.emit("parseError", new Error("connection closed due to parseError"), server);
              }

              // If we are a single server connection fire errors correctly
              if(!server.isSetMember()) {
                // Fire all callback errors
                server.__executeAllCallbacksWithError(new Error("connection closed due to parseError"));
                // Emit error
                _emitAcrossAllDbInstances(server, eventReceiver, "parseError", server, null, true);
              }
              // Short cut
              return;
            }

            // Let's record the stats info if it's enabled
            if(server.recordQueryStats == true && server._state['runtimeStats'] != null
              && server._state.runtimeStats['queryStats'] instanceof RunningStats) {
              // Add data point to the running statistics object
              server._state.runtimeStats.queryStats.push(new Date().getTime() - callbackInfo.info.start);
            }

            server._callHandler(mongoReply.responseTo, mongoReply, null);
          });
        }
      }
    } catch (err) {
      // Throw error in next tick
      processor(function() {
        throw err;
      })
    }
  });

  // Handle timeout
  connectionPool.on("timeout", function(err) {
    // If pool connection is already closed
    if(server._serverState === 'disconnected') return;
    // Set server state to disconnected
    server._serverState = 'disconnected';
    // If we have a callback return the error
    if(typeof callback === 'function') {
      // ensure no callbacks get called twice
      var internalCallback = callback;
      callback = null;
      // Perform callback
      internalCallback(err, null, server);
    } else if(server.isSetMember()) {
      if(server.listeners("timeout") && server.listeners("timeout").length > 0) server.emit("timeout", err, server);
    } else {
      if(eventReceiver.listeners("timeout") && eventReceiver.listeners("timeout").length > 0) eventReceiver.emit("timeout", err, server);
    }

    // If we are a single server connection fire errors correctly
    if(!server.isSetMember()) {
      // Fire all callback errors
      server.__executeAllCallbacksWithError(err);
      // Emit error
      _emitAcrossAllDbInstances(server, eventReceiver, "timeout", err, server, true);
    }
  });

  // Handle errors
  connectionPool.on("error", function(message, connection, error_options) {
    // If pool connection is already closed
    if(server._serverState === 'disconnected') return;
    // Set server state to disconnected
    server._serverState = 'disconnected';
    // Error message
    var error_message = new Error(message && message.err ? message.err : message);
    // Error message coming from ssl
    if(error_options && error_options.ssl) error_message.ssl = true;
    // If we have a callback return the error
    if(typeof callback === 'function') {
      // ensure no callbacks get called twice
      var internalCallback = callback;
      callback = null;
      // Perform callback
      internalCallback(error_message, null, server);
    } else if(server.isSetMember()) {
      if(server.listeners("error") && server.listeners("error").length > 0) server.emit("error", error_message, server);
    } else {
      if(eventReceiver.listeners("error") && eventReceiver.listeners("error").length > 0) eventReceiver.emit("error", error_message, server);
    }

    // If we are a single server connection fire errors correctly
    if(!server.isSetMember()) {
      // Fire all callback errors
      server.__executeAllCallbacksWithError(error_message);
      // Emit error
      _emitAcrossAllDbInstances(server, eventReceiver, "error", error_message, server, true);
    }
  });

  // Handle close events
  connectionPool.on("close", function() {
    // If pool connection is already closed
    if(server._serverState === 'disconnected') return;
    // Set server state to disconnected
    server._serverState = 'disconnected';
    // If we have a callback return the error
    if(typeof callback == 'function') {
      // ensure no callbacks get called twice
      var internalCallback = callback;
      callback = null;
      // Perform callback
      internalCallback(new Error("connection closed"), null, server);
    } else if(server.isSetMember()) {
      if(server.listeners("close") && server.listeners("close").length > 0) server.emit("close", new Error("connection closed"), server);
    } else {
      if(eventReceiver.listeners("close") && eventReceiver.listeners("close").length > 0) eventReceiver.emit("close", new Error("connection closed"), server);
    }

    // If we are a single server connection fire errors correctly
    if(!server.isSetMember()) {
      // Fire all callback errors
      server.__executeAllCallbacksWithError(new Error("connection closed"));
      // Emit error
      _emitAcrossAllDbInstances(server, eventReceiver, "close", server, null, true);
    }
  });

  // If we have a parser error we are in an unknown state, close everything and emit
  // error
  connectionPool.on("parseError", function(message) {
    // If pool connection is already closed
    if(server._serverState === 'disconnected') return;
    // Set server state to disconnected
    server._serverState = 'disconnected';
    // If we have a callback return the error
    if(typeof callback === 'function') {
      // ensure no callbacks get called twice
      var internalCallback = callback;
      callback = null;
      // Perform callback
      internalCallback(new Error("connection closed due to parseError"), null, server);
    } else if(server.isSetMember()) {
      if(server.listeners("parseError") && server.listeners("parseError").length > 0) server.emit("parseError", new Error("connection closed due to parseError"), server);
    } else {
      if(eventReceiver.listeners("parseError") && eventReceiver.listeners("parseError").length > 0) eventReceiver.emit("parseError", new Error("connection closed due to parseError"), server);
    }

    // If we are a single server connection fire errors correctly
    if(!server.isSetMember()) {
      // Fire all callback errors
      server.__executeAllCallbacksWithError(new Error("connection closed due to parseError"));
      // Emit error
      _emitAcrossAllDbInstances(server, eventReceiver, "parseError", server, null, true);
    }
  });

  // Boot up connection poole, pass in a locator of callbacks
  connectionPool.start();
}

/**
 * @ignore
 */
var _emitAcrossAllDbInstances = function(server, filterDb, event, message, object, resetConnection) {
  // Emit close event across all db instances sharing the sockets
  var allServerInstances = server.allServerInstances();
  // Fetch the first server instance
  var serverInstance = allServerInstances[0];
  // For all db instances signal all db instances
  if(Array.isArray(serverInstance.dbInstances) && serverInstance.dbInstances.length >= 1) {
	  for(var i = 0; i < serverInstance.dbInstances.length; i++) {
      var dbInstance = serverInstance.dbInstances[i];
      // Set the parent
      if(resetConnection && typeof dbInstance.openCalled != 'undefined')
        dbInstance.openCalled = false;
      // Check if it's our current db instance and skip if it is
      if(filterDb == null || filterDb.databaseName !== dbInstance.databaseName || filterDb.tag !== dbInstance.tag) {
        // Only emit if there is a listener
        if(dbInstance.listeners(event).length > 0)
  	     dbInstance.emit(event, message, object);
      }
    }
  }
}

/**
 * @ignore
 */
Server.prototype.allRawConnections = function() {
  return this.connectionPool.getAllConnections();
}

/**
 * Check if a writer can be provided
 * @ignore
 */
var canCheckoutWriter = function(self, read) {
  // We cannot write to an arbiter or secondary server
  if(self.isMasterDoc['arbiterOnly'] == true) {
    return new Error("Cannot write to an arbiter");
  } if(self.isMasterDoc['secondary'] == true) {
    return new Error("Cannot write to a secondary");
  } else if(read == true && self._readPreference == ReadPreference.SECONDARY && self.isMasterDoc['ismaster'] == true) {
    return new Error("Cannot read from primary when secondary only specified");
  }

  // Return no error
  return null;
}

/**
 * @ignore
 */
Server.prototype.checkoutWriter = function(read) {
  if(read == true) return this.connectionPool.checkoutConnection();
  // Check if are allowed to do a checkout (if we try to use an arbiter f.ex)
  var result = canCheckoutWriter(this, read);
  // If the result is null check out a writer
  if(result == null && this.connectionPool != null) {
    return this.connectionPool.checkoutConnection();
  } else if(result == null) {
    return null;
  } else {
    return result;
  }
}

/**
 * Check if a reader can be provided
 * @ignore
 */
var canCheckoutReader = function(self) {
  // We cannot write to an arbiter or secondary server
  if(self.isMasterDoc && self.isMasterDoc['arbiterOnly'] == true) {
    return new Error("Cannot write to an arbiter");
  } else if(self._readPreference != null) {
    // If the read preference is Primary and the instance is not a master return an error
    if((self._readPreference == ReadPreference.PRIMARY) && self.isMasterDoc['ismaster'] != true) {
      return new Error("Read preference is Server.PRIMARY and server is not master");
    } else if(self._readPreference == ReadPreference.SECONDARY && self.isMasterDoc['ismaster'] == true) {
      return new Error("Cannot read from primary when secondary only specified");
    }
  }

  // Return no error
  return null;
}

/**
 * @ignore
 */
Server.prototype.checkoutReader = function() {
  // Check if are allowed to do a checkout (if we try to use an arbiter f.ex)
  var result = canCheckoutReader(this);
  // If the result is null check out a writer
  if(result == null && this.connectionPool != null) {
    return this.connectionPool.checkoutConnection();
  } else if(result == null) {
    return null;
  } else {
    return result;
  }
}

/**
 * @ignore
 */
Server.prototype.enableRecordQueryStats = function(enable) {
  this.recordQueryStats = enable;
}

/**
 * Internal statistics object used for calculating average and standard devitation on
 * running queries
 * @ignore
 */
var RunningStats = function() {
  var self = this;
  this.m_n = 0;
  this.m_oldM = 0.0;
  this.m_oldS = 0.0;
  this.m_newM = 0.0;
  this.m_newS = 0.0;

  // Define getters
  Object.defineProperty(this, "numDataValues", { enumerable: true
    , get: function () { return this.m_n; }
  });

  Object.defineProperty(this, "mean", { enumerable: true
    , get: function () { return (this.m_n > 0) ? this.m_newM : 0.0; }
  });

  Object.defineProperty(this, "variance", { enumerable: true
    , get: function () { return ((this.m_n > 1) ? this.m_newS/(this.m_n - 1) : 0.0); }
  });

  Object.defineProperty(this, "standardDeviation", { enumerable: true
    , get: function () { return Math.sqrt(this.variance); }
  });

  Object.defineProperty(this, "sScore", { enumerable: true
    , get: function () {
      var bottom = this.mean + this.standardDeviation;
      if(bottom == 0) return 0;
      return ((2 * this.mean * this.standardDeviation)/(bottom));
    }
  });
}

/**
 * @ignore
 */
RunningStats.prototype.push = function(x) {
  // Update the number of samples
  this.m_n = this.m_n + 1;
  // See Knuth TAOCP vol 2, 3rd edition, page 232
  if(this.m_n == 1) {
    this.m_oldM = this.m_newM = x;
    this.m_oldS = 0.0;
  } else {
    this.m_newM = this.m_oldM + (x - this.m_oldM) / this.m_n;
    this.m_newS = this.m_oldS + (x - this.m_oldM) * (x - this.m_newM);

    // set up for next iteration
    this.m_oldM = this.m_newM;
    this.m_oldS = this.m_newS;
  }
}

/**
 * @ignore
 */
Object.defineProperty(Server.prototype, "autoReconnect", { enumerable: true
  , get: function () {
      return this.options['auto_reconnect'] == null ? false : this.options['auto_reconnect'];
    }
});

/**
 * @ignore
 */
Object.defineProperty(Server.prototype, "connection", { enumerable: true
  , get: function () {
      return this.internalConnection;
    }
  , set: function(connection) {
      this.internalConnection = connection;
    }
});

/**
 * @ignore
 */
Object.defineProperty(Server.prototype, "master", { enumerable: true
  , get: function () {
      return this.internalMaster;
    }
  , set: function(value) {
      this.internalMaster = value;
    }
});

/**
 * @ignore
 */
Object.defineProperty(Server.prototype, "primary", { enumerable: true
  , get: function () {
      return this;
    }
});

/**
 * Getter for query Stats
 * @ignore
 */
Object.defineProperty(Server.prototype, "queryStats", { enumerable: true
  , get: function () {
      return this._state.runtimeStats.queryStats;
    }
});

/**
 * @ignore
 */
Object.defineProperty(Server.prototype, "runtimeStats", { enumerable: true
  , get: function () {
      return this._state.runtimeStats;
    }
});

/**
 * Get Read Preference method
 * @ignore
 */
Object.defineProperty(Server.prototype, "readPreference", { enumerable: true
  , get: function () {
      if(this._readPreference == null && this.readSecondary) {
        return Server.READ_SECONDARY;
      } else if(this._readPreference == null && !this.readSecondary) {
        return Server.READ_PRIMARY;
      } else {
        return this._readPreference;
      }
    }
});

/**
 * @ignore
 */
exports.Server = Server;
