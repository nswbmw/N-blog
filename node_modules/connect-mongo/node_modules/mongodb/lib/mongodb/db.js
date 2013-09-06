/**
 * Module dependencies.
 * @ignore
 */
var QueryCommand = require('./commands/query_command').QueryCommand,
  DbCommand = require('./commands/db_command').DbCommand,
  MongoReply = require('./responses/mongo_reply').MongoReply,
  Admin = require('./admin').Admin,
  Collection = require('./collection').Collection,
  Server = require('./connection/server').Server,
  ReplSet = require('./connection/repl_set').ReplSet,
  ReadPreference = require('./connection/read_preference').ReadPreference,
  Mongos = require('./connection/mongos').Mongos,
  Cursor = require('./cursor').Cursor,
  EventEmitter = require('events').EventEmitter,
  inherits = require('util').inherits,
  crypto = require('crypto'),
  timers = require('timers'),
  utils = require('./utils'),
  parse = require('./connection/url_parser').parse;

// Set processor, setImmediate if 0.10 otherwise nextTick
var processor = timers.setImmediate ? timers.setImmediate : process.nextTick;
processor = process.nextTick

/**
 * Create a new Db instance.
 *
 * Options
 *  - **w**, {Number/String, > -1 || 'majority' || tag name} the write concern for the operation where < 1 is no acknowlegement of write and w >= 1, w = 'majority' or tag acknowledges the write
 *  - **wtimeout**, {Number, 0} set the timeout for waiting for write concern to finish (combines with w option)
 *  - **fsync**, (Boolean, default:false) write waits for fsync before returning
 *  - **journal**, (Boolean, default:false) write waits for journal sync before returning
 *  - **readPreference** {String}, the prefered read preference (ReadPreference.PRIMARY, ReadPreference.PRIMARY_PREFERRED, ReadPreference.SECONDARY, ReadPreference.SECONDARY_PREFERRED, ReadPreference.NEAREST).
 *  - **native_parser** {Boolean, default:false}, use c++ bson parser.
 *  - **forceServerObjectId** {Boolean, default:false}, force server to create _id fields instead of client.
 *  - **pkFactory** {Object}, object overriding the basic ObjectID primary key generation.
 *  - **serializeFunctions** {Boolean, default:false}, serialize functions.
 *  - **raw** {Boolean, default:false}, peform operations using raw bson buffers.
 *  - **recordQueryStats** {Boolean, default:false}, record query statistics during execution.
 *  - **retryMiliSeconds** {Number, default:5000}, number of miliseconds between retries.
 *  - **numberOfRetries** {Number, default:5}, number of retries off connection.
 *  - **logger** {Object, default:null}, an object representing a logger that you want to use, needs to support functions debug, log, error **({error:function(message, object) {}, log:function(message, object) {}, debug:function(message, object) {}})**.
 * 
 * Deprecated Options 
 *  - **safe** {true | {w:n, wtimeout:n} | {fsync:true}, default:false}, executes with a getLastError command returning the results of the command on MongoDB.
 *
 * @class Represents a Db
 * @param {String} databaseName name of the database.
 * @param {Object} serverConfig server config object.
 * @param {Object} [options] additional options for the collection.
 */
function Db(databaseName, serverConfig, options) {
  if(!(this instanceof Db)) return new Db(databaseName, serverConfig, options);

  EventEmitter.call(this);
  this.databaseName = databaseName;
  this.serverConfig = serverConfig;
  this.options = options == null ? {} : options;
  // State to check against if the user force closed db
  this._applicationClosed = false;
  // Fetch the override flag if any
  var overrideUsedFlag = this.options['override_used_flag'] == null ? false : this.options['override_used_flag'];

  // Verify that nobody is using this config
  if(!overrideUsedFlag && this.serverConfig != null && typeof this.serverConfig == 'object' && this.serverConfig._isUsed && this.serverConfig._isUsed()) {    
    throw new Error("A Server or ReplSet instance cannot be shared across multiple Db instances");
  } else if(!overrideUsedFlag && typeof this.serverConfig == 'object'){
    // Set being used
    this.serverConfig._used = true;
  }

  // Ensure we have a valid db name
  validateDatabaseName(databaseName);

  // Contains all the connections for the db
  try {
    this.native_parser = this.options.native_parser;
    // The bson lib
    var bsonLib = this.bsonLib = this.options.native_parser ? require('bson').BSONNative : require('bson').BSONPure;
    // Fetch the serializer object
    var BSON = bsonLib.BSON;
    // Create a new instance
    this.bson = new BSON([bsonLib.Long, bsonLib.ObjectID, bsonLib.Binary, bsonLib.Code, bsonLib.DBRef, bsonLib.Symbol, bsonLib.Double, bsonLib.Timestamp, bsonLib.MaxKey, bsonLib.MinKey]);
    // Backward compatibility to access types
    this.bson_deserializer = bsonLib;
    this.bson_serializer = bsonLib;
  } catch (err) {
    // If we tried to instantiate the native driver
    var msg = "Native bson parser not compiled, please compile "
            + "or avoid using native_parser=true";
    throw Error(msg);
  }

  // Internal state of the server
  this._state = 'disconnected';

  this.pkFactory = this.options.pk == null ? bsonLib.ObjectID : this.options.pk;
  this.forceServerObjectId = this.options.forceServerObjectId != null ? this.options.forceServerObjectId : false;

  // Added safe
  this.safe = this.options.safe == null ? false : this.options.safe;  

  // If we have not specified a "safe mode" we just print a warning to the console
  if(this.options.safe == null && this.options.w == null && this.options.journal == null && this.options.fsync == null) {
    console.log("========================================================================================");
    console.log("=  Please ensure that you set the default write concern for the database by setting    =");
    console.log("=   one of the options                                                                 =");
    console.log("=                                                                                      =");
    console.log("=     w: (value of > -1 or the string 'majority'), where < 1 means                     =");
    console.log("=        no write acknowlegement                                                       =");
    console.log("=     journal: true/false, wait for flush to journal before acknowlegement             =");
    console.log("=     fsync: true/false, wait for flush to file system before acknowlegement           =");
    console.log("=                                                                                      =");
    console.log("=  For backward compatibility safe is still supported and                              =");
    console.log("=   allows values of [true | false | {j:true} | {w:n, wtimeout:n} | {fsync:true}]      =");
    console.log("=   the default value is false which means the driver receives does not                =");
    console.log("=   return the information of the success/error of the insert/update/remove            =");
    console.log("=                                                                                      =");
    console.log("=   ex: new Db(new Server('localhost', 27017), {safe:false})                           =");
    console.log("=                                                                                      =");
    console.log("=   http://www.mongodb.org/display/DOCS/getLastError+Command                           =");
    console.log("=                                                                                      =");
    console.log("=  The default of no acknowlegement will change in the very near future                =");
    console.log("=                                                                                      =");
    console.log("=  This message will disappear when the default safe is set on the driver Db           =");
    console.log("========================================================================================");
  }

  // Internal states variables
  this.notReplied ={};
  this.isInitializing = true;
  this.auths = [];
  this.openCalled = false;

  // Command queue, keeps a list of incoming commands that need to be executed once the connection is up
  this.commands = [];

  // Set up logger
  this.logger = this.options.logger != null
    && (typeof this.options.logger.debug == 'function')
    && (typeof this.options.logger.error == 'function')
    && (typeof this.options.logger.log == 'function')
      ? this.options.logger : {error:function(message, object) {}, log:function(message, object) {}, debug:function(message, object) {}};
  // Allow slaveOk
  this.slaveOk = this.options["slave_ok"] == null ? false : this.options["slave_ok"];

  var self = this;
  // Associate the logger with the server config
  this.serverConfig.logger = this.logger;
  if(this.serverConfig.strategyInstance) this.serverConfig.strategyInstance.logger = this.logger;
  this.tag = new Date().getTime();
  // Just keeps list of events we allow
  this.eventHandlers = {error:[], parseError:[], poolReady:[], message:[], close:[]};

  // Controls serialization options
  this.serializeFunctions = this.options.serializeFunctions != null ? this.options.serializeFunctions : false;

  // Raw mode
  this.raw = this.options.raw != null ? this.options.raw : false;

  // Record query stats
  this.recordQueryStats = this.options.recordQueryStats != null ? this.options.recordQueryStats : false;

  // If we have server stats let's make sure the driver objects have it enabled
  if(this.recordQueryStats == true) {
    this.serverConfig.enableRecordQueryStats(true);
  }

  // Retry information
  this.retryMiliSeconds = this.options.retryMiliSeconds != null ? this.options.retryMiliSeconds : 1000;
  this.numberOfRetries = this.options.numberOfRetries != null ? this.options.numberOfRetries : 60;

  // Set default read preference if any
  this.readPreference = this.options.readPreference;
};

/**
 * @ignore
 */
function validateDatabaseName(databaseName) {
  if(typeof databaseName !== 'string') throw new Error("database name must be a string");
  if(databaseName.length === 0) throw new Error("database name cannot be the empty string");

  var invalidChars = [" ", ".", "$", "/", "\\"];
  for(var i = 0; i < invalidChars.length; i++) {
    if(databaseName.indexOf(invalidChars[i]) != -1) throw new Error("database names cannot contain the character '" + invalidChars[i] + "'");
  }
}

/**
 * @ignore
 */
inherits(Db, EventEmitter);

/**
 * Initialize the database connection.
 *
 * @param {Function} callback this will be called after executing this method. The first parameter will contain the Error object if an error occured, or null otherwise. While the second parameter will contain the index information or null if an error occured.
 * @return {null}
 * @api public
 */
Db.prototype.open = function(callback) {
  var self = this;

  // Check that the user has not called this twice
  if(this.openCalled) {
    // Close db
    this.close();
    // Throw error
    throw new Error("db object already connecting, open cannot be called multiple times");
  }

  // If we have a specified read preference
  if(this.readPreference != null) this.serverConfig.setReadPreference(this.readPreference);

  // Set that db has been opened
  this.openCalled = true;

  // Set the status of the server
  self._state = 'connecting';
  // Set up connections
  if(self.serverConfig instanceof Server || self.serverConfig instanceof ReplSet || self.serverConfig instanceof Mongos) {
    self.serverConfig.connect(self, {firstCall: true}, function(err, result) {
      if(err != null) {
        // Set that db has been closed
        self.openCalled = false;
        // Return error from connection
        return callback(err, null);
      }
      // Set the status of the server
      self._state = 'connected';
      // If we have queued up commands execute a command to trigger replays
      if(self.commands.length > 0) _execute_queued_command(self);
      // Callback
      return callback(null, self);
    });
  } else {
    return callback(Error("Server parameter must be of type Server, ReplSet or Mongos"), null);
  }
};

// Execute any baked up commands
var _execute_queued_command = function(self) {
  // Execute any backed up commands
  processor(function() {
    // Execute any backed up commands
    while(self.commands.length > 0) {
      // Fetch the command
      var command = self.commands.shift();
      // Execute based on type
      if(command['type'] == 'query') {
        __executeQueryCommand(self, command['db_command'], command['options'], command['callback']);
      } else if(command['type'] == 'insert') {
        __executeInsertCommand(self, command['db_command'], command['options'], command['callback']);
      }
    }
  });  
}

/**
 * Create a new Db instance sharing the current socket connections.
 *
 * @param {String} dbName the name of the database we want to use.
 * @return {Db} a db instance using the new database.
 * @api public
 */
Db.prototype.db = function(dbName) {
  // Copy the options and add out internal override of the not shared flag
  var options = {};
  for(var key in this.options) {
    options[key] = this.options[key];
  }

  // Add override flag
  options['override_used_flag'] = true;
  // Create a new db instance
  var newDbInstance = new Db(dbName, this.serverConfig, options);
  //copy over any auths, we may need them for reconnecting
  if (this.serverConfig.db) {
    newDbInstance.auths = this.serverConfig.db.auths;
  }
  // Add the instance to the list of approved db instances
  var allServerInstances = this.serverConfig.allServerInstances();
  // Add ourselves to all server callback instances
  for(var i = 0; i < allServerInstances.length; i++) {
    var server = allServerInstances[i];
    server.dbInstances.push(newDbInstance);
  }
  // Return new db object
  return newDbInstance;  
}

/**
 * Close the current db connection, including all the child db instances. Emits close event if no callback is provided.
 *
 * @param {Boolean} [forceClose] connection can never be reused.
 * @param {Function} callback this will be called after executing this method. The first parameter will contain the Error object if an error occured, or null otherwise. While the second parameter will contain the results or null if an error occured.
 * @return {null}
 * @api public
 */
Db.prototype.close = function(forceClose, callback) {
  var self = this;
  // Ensure we force close all connections
  this._applicationClosed = false;

  if(typeof forceClose == 'function') {
    callback = forceClose;
  } else if(typeof forceClose == 'boolean') {
    this._applicationClosed = forceClose;
  }

  // Remove all listeners and close the connection
  this.serverConfig.close(function(err, result) {
    // Emit the close event
    if(typeof callback !== 'function') self.emit("close");

    // Emit close event across all db instances sharing the sockets
    var allServerInstances = self.serverConfig.allServerInstances();
    // Fetch the first server instance
    if(Array.isArray(allServerInstances) && allServerInstances.length > 0) {
      var server = allServerInstances[0];
      // For all db instances signal all db instances
      if(Array.isArray(server.dbInstances) && server.dbInstances.length > 1) {
        for(var i = 0; i < server.dbInstances.length; i++) {
          var dbInstance = server.dbInstances[i];
          // Check if it's our current db instance and skip if it is
          if(dbInstance.databaseName !== self.databaseName && dbInstance.tag !== self.tag) {
            server.dbInstances[i].emit("close");
          }
        }
      }
    }

    // Remove all listeners
    self.removeAllEventListeners();
    // You can reuse the db as everything is shut down
    self.openCalled = false;
    // If we have a callback call it
    if(callback) callback(err, result);
  });
};

/**
 * Access the Admin database
 *
 * @param {Function} [callback] returns the results.
 * @return {Admin} the admin db object.
 * @api public
 */
Db.prototype.admin = function(callback) {
  if(callback == null) return new Admin(this);
  callback(null, new Admin(this));
};

/**
 * Returns a cursor to all the collection information.
 *
 * @param {String} [collectionName] the collection name we wish to retrieve the information from.
 * @param {Function} callback this will be called after executing this method. The first parameter will contain the Error object if an error occured, or null otherwise. While the second parameter will contain the options or null if an error occured.
 * @return {null}
 * @api public
 */
Db.prototype.collectionsInfo = function(collectionName, callback) {
  if(callback == null && typeof collectionName == 'function') { callback = collectionName; collectionName = null; }
  // Create selector
  var selector = {};
  // If we are limiting the access to a specific collection name
  if(collectionName != null) selector.name = this.databaseName + "." + collectionName;

  // Return Cursor
  // callback for backward compatibility
  if(callback) {
    callback(null, new Cursor(this, new Collection(this, DbCommand.SYSTEM_NAMESPACE_COLLECTION), selector));
  } else {
    return new Cursor(this, new Collection(this, DbCommand.SYSTEM_NAMESPACE_COLLECTION), selector);
  }
};

/**
 * Get the list of all collection names for the specified db
 *
 * Options
 *  - **namesOnly** {String, default:false}, Return only the full collection namespace.
 *
 * @param {String} [collectionName] the collection name we wish to filter by.
 * @param {Object} [options] additional options during update.
 * @param {Function} callback this will be called after executing this method. The first parameter will contain the Error object if an error occured, or null otherwise. While the second parameter will contain the collection names or null if an error occured.
 * @return {null}
 * @api public
 */
Db.prototype.collectionNames = function(collectionName, options, callback) {
  var self = this;
  var args = Array.prototype.slice.call(arguments, 0);
  callback = args.pop();
  collectionName = args.length ? args.shift() : null;
  options = args.length ? args.shift() : {};

  // Ensure no breaking behavior
  if(collectionName != null && typeof collectionName == 'object') {
    options = collectionName;
    collectionName = null;
  }

  // Let's make our own callback to reuse the existing collections info method
  self.collectionsInfo(collectionName, function(err, cursor) {
    if(err != null) return callback(err, null);

    cursor.toArray(function(err, documents) {
      if(err != null) return callback(err, null);

      // List of result documents that have been filtered
      var filtered_documents = documents.filter(function(document) {
        return !(document.name.indexOf(self.databaseName) == -1 || document.name.indexOf('$') != -1);
      });

      // If we are returning only the names
      if(options.namesOnly) {
        filtered_documents = filtered_documents.map(function(document) { return document.name });
      }

      // Return filtered items
      callback(null, filtered_documents);
    });
  });
};

/**
 * Fetch a specific collection (containing the actual collection information). If the application does not use strict mode you can
 * can use it without a callback in the following way. var collection = db.collection('mycollection');
 *
 * Options
*  - **w**, {Number/String, > -1 || 'majority' || tag name} the write concern for the operation where < 1 is no acknowlegement of write and w >= 1, w = 'majority' or tag acknowledges the write
 *  - **wtimeout**, {Number, 0} set the timeout for waiting for write concern to finish (combines with w option)
 *  - **fsync**, (Boolean, default:false) write waits for fsync before returning
 *  - **journal**, (Boolean, default:false) write waits for journal sync before returning
 *  - **serializeFunctions** {Boolean, default:false}, serialize functions on the document.
 *  - **raw** {Boolean, default:false}, perform all operations using raw bson objects.
 *  - **pkFactory** {Object}, object overriding the basic ObjectID primary key generation.
 *  - **readPreference** {String}, the prefered read preference (ReadPreference.PRIMARY, ReadPreference.PRIMARY_PREFERRED, ReadPreference.SECONDARY, ReadPreference.SECONDARY_PREFERRED, ReadPreference.NEAREST).
 *  - **strict**, (Boolean, default:false) throws and error if the collection does not exist
 * 
 * Deprecated Options 
 *  - **safe** {true | {w:n, wtimeout:n} | {fsync:true}, default:false}, executes with a getLastError command returning the results of the command on MongoDB.
 *
 * @param {String} collectionName the collection name we wish to access.
 * @param {Object} [options] returns option results.
 * @param {Function} callback this will be called after executing this method. The first parameter will contain the Error object if an error occured, or null otherwise. While the second parameter will contain the collection or null if an error occured.
 * @return {null}
 * @api public
 */
Db.prototype.collection = function(collectionName, options, callback) {
  var self = this;
  if(typeof options === "function") { callback = options; options = {}; }
  // Execute safe

  if(options && (options.strict)) {
    self.collectionNames(collectionName, function(err, collections) {
      if(err != null) return callback(err, null);

      if(collections.length == 0) {
        return callback(new Error("Collection " + collectionName + " does not exist. Currently in safe mode."), null);
      } else {
        try {
          var collection = new Collection(self, collectionName, self.pkFactory, options);
        } catch(err) {
          return callback(err, null);
        }
        return callback(null, collection);
      }
    });
  } else {
    try {
      var collection = new Collection(self, collectionName, self.pkFactory, options);
    } catch(err) {
      if(callback == null) {
        throw err;
      } else {
        return callback(err, null);
      }
    }

    // If we have no callback return collection object
    return callback == null ? collection : callback(null, collection);
  }
};

/**
 * Fetch all collections for the current db.
 *
 * @param {Function} callback this will be called after executing this method. The first parameter will contain the Error object if an error occured, or null otherwise. While the second parameter will contain the collections or null if an error occured.
 * @return {null}
 * @api public
 */
Db.prototype.collections = function(callback) {
  var self = this;
  // Let's get the collection names
  self.collectionNames(function(err, documents) {
    if(err != null) return callback(err, null);
    var collections = [];
    documents.forEach(function(document) {
      collections.push(new Collection(self, document.name.replace(self.databaseName + ".", ''), self.pkFactory));
    });
    // Return the collection objects
    callback(null, collections);
  });
};

/**
 * Evaluate javascript on the server
 *
 * Options
 *  - **nolock** {Boolean, default:false}, Tell MongoDB not to block on the evaulation of the javascript.
 *
 * @param {Code} code javascript to execute on server.
 * @param {Object|Array} [parameters] the parameters for the call.
 * @param {Object} [options] the options
 * @param {Function} callback this will be called after executing this method. The first parameter will contain the Error object if an error occured, or null otherwise. While the second parameter will contain the results from eval or null if an error occured.
 * @return {null}
 * @api public
 */
Db.prototype.eval = function(code, parameters, options, callback) {
  // Unpack calls
  var args = Array.prototype.slice.call(arguments, 1);
  callback = args.pop();
  parameters = args.length ? args.shift() : parameters;
  options = args.length ? args.shift() : {};

  var finalCode = code;
  var finalParameters = [];
  // If not a code object translate to one
  if(!(finalCode instanceof this.bsonLib.Code)) {
    finalCode = new this.bsonLib.Code(finalCode);
  }

  // Ensure the parameters are correct
  if(parameters != null && parameters.constructor != Array && typeof parameters !== 'function') {
    finalParameters = [parameters];
  } else if(parameters != null && parameters.constructor == Array && typeof parameters !== 'function') {
    finalParameters = parameters;
  }

  // Create execution selector
  var selector = {'$eval':finalCode, 'args':finalParameters};
  // Check if the nolock parameter is passed in
  if(options['nolock']) {
    selector['nolock'] = options['nolock'];
  }

  // Set primary read preference
  options.readPreference = ReadPreference.PRIMARY;

  // Execute the eval
  this.collection(DbCommand.SYSTEM_COMMAND_COLLECTION).findOne(selector, options, function(err, result) {
    if(err) return callback(err);

    if(result && result.ok == 1) {
      callback(null, result.retval);
    } else if(result) {
      callback(new Error("eval failed: " + result.errmsg), null); return;
    } else {
      callback(err, result);
    }
  });
};

/**
 * Dereference a dbref, against a db
 *
 * @param {DBRef} dbRef db reference object we wish to resolve.
 * @param {Function} callback this will be called after executing this method. The first parameter will contain the Error object if an error occured, or null otherwise. While the second parameter will contain the results from dereference or null if an error occured.
 * @return {null}
 * @api public
 */
Db.prototype.dereference = function(dbRef, callback) {
  var db = this;
  // If we have a db reference then let's get the db first
  if(dbRef.db != null) db = this.db(dbRef.db);
  // Fetch the collection and find the reference
  var collection = db.collection(dbRef.namespace);
  collection.findOne({'_id':dbRef.oid}, function(err, result) {
    callback(err, result);
  });
};

/**
 * Logout user from server, fire off on all connections and remove all auth info
 *
 * @param {Function} callback this will be called after executing this method. The first parameter will contain the Error object if an error occured, or null otherwise. While the second parameter will contain the results from logout or null if an error occured.
 * @return {null}
 * @api public
 */
Db.prototype.logout = function(options, callback) {
  var self = this;
  // Unpack calls
  var args = Array.prototype.slice.call(arguments, 0);
  callback = args.pop();
  options = args.length ? args.shift() : {};

  // Number of connections we need to logout from
  var numberOfConnections = this.serverConfig.allRawConnections().length;

  // Let's generate the logout command object
  var logoutCommand = DbCommand.logoutCommand(self, {logout:1}, options);
  self._executeQueryCommand(logoutCommand, {onAll:true}, function(err, result) {
    // Count down
    numberOfConnections = numberOfConnections - 1;
    // Work around the case where the number of connections are 0
    if(numberOfConnections <= 0 && typeof callback == 'function') {
      var internalCallback = callback;
      callback = null;
      // Reset auth
      self.auths = [];
      // Handle any errors
      if(err == null && result.documents[0].ok == 1) {
        internalCallback(null, true);
      } else {
        err != null ? internalCallback(err, false) : internalCallback(new Error(result.documents[0].errmsg), false);
      }
    }
  });
}

/**
 * Authenticate a user against the server.
 *
 * Options
 *  - **authSource** {String}, The database that the credentials are for,
 *    different from the name of the current DB, for example admin
 *
 * @param {String} username username.
 * @param {String} password password.
 * @param {Object} [options] the options
 * @param {Function} callback this will be called after executing this method. The first parameter will contain the Error object if an error occured, or null otherwise. While the second parameter will contain the results from authentication or null if an error occured.
 * @return {null}
 * @api public
 */
Db.prototype.authenticate = function(username, password, options, callback) {
  var self = this;

  if (typeof callback === 'undefined') {
    callback = options;
    options = {};
  }
  // the default db to authenticate against is 'this'
  // if authententicate is called from a retry context, it may be another one, like admin
  var authdb = options.authdb ? options.authdb : self.databaseName;
  authdb = options.authSource ? options.authSource : authdb;
  // Push the new auth if we have no previous record
  
  var numberOfConnections = 0;
  var errorObject = null;

  if(options['connection'] != null) {
    //if a connection was explicitly passed on options, then we have only one...
    numberOfConnections = 1;
  } else {
    // Get the amount of connections in the pool to ensure we have authenticated all comments
    numberOfConnections = this.serverConfig.allRawConnections().length;
    options['onAll'] = true;
  }

  // Execute all four
  this._executeQueryCommand(DbCommand.createGetNonceCommand(self), options, function(err, result, connection) {
    // Execute on all the connections
    if(err == null) {
      // Nonce used to make authentication request with md5 hash
      var nonce = result.documents[0].nonce;
      // Execute command
      self._executeQueryCommand(DbCommand.createAuthenticationCommand(self, username, password, nonce, authdb), {connection:connection}, function(err, result) {
        // Count down
        numberOfConnections = numberOfConnections - 1;
        // Ensure we save any error
        if(err) {
          errorObject = err;
        } else if(result.documents[0].err != null || result.documents[0].errmsg != null){
          errorObject = utils.toError(result.documents[0]);
        }

        // Work around the case where the number of connections are 0
        if(numberOfConnections <= 0 && typeof callback == 'function') {
          var internalCallback = callback;
          callback = null;

          if(errorObject == null && result.documents[0].ok == 1) {
            // We authenticated correctly save the credentials
            self.auths = [{'username':username, 'password':password, 'authdb': authdb}];
            // Return callback
            internalCallback(errorObject, true);
          } else {
            internalCallback(errorObject, false);
          }
        }
      });
    }
  });
};

/**
 * Add a user to the database.
 *
 * Options
 *  - **w**, {Number/String, > -1 || 'majority' || tag name} the write concern for the operation where < 1 is no acknowlegement of write and w >= 1, w = 'majority' or tag acknowledges the write
 *  - **wtimeout**, {Number, 0} set the timeout for waiting for write concern to finish (combines with w option)
 *  - **fsync**, (Boolean, default:false) write waits for fsync before returning
 *  - **journal**, (Boolean, default:false) write waits for journal sync before returning
 * 
 * Deprecated Options 
 *  - **safe** {true | {w:n, wtimeout:n} | {fsync:true}, default:false}, executes with a getLastError command returning the results of the command on MongoDB.
 *
 * @param {String} username username.
 * @param {String} password password.
 * @param {Object} [options] additional options during update.
 * @param {Function} callback this will be called after executing this method. The first parameter will contain the Error object if an error occured, or null otherwise. While the second parameter will contain the results from addUser or null if an error occured.
 * @return {null}
 * @api public
 */
Db.prototype.addUser = function(username, password, options, callback) {
  var self = this;
  var args = Array.prototype.slice.call(arguments, 2);
  callback = args.pop();
  options = args.length ? args.shift() : {};

  // Get the error options
  var errorOptions = _getWriteConcern(this, options, callback);
  errorOptions.w = errorOptions.w == null ? 1 : errorOptions.w;
  // Use node md5 generator
  var md5 = crypto.createHash('md5');
  // Generate keys used for authentication
  md5.update(username + ":mongo:" + password);
  var userPassword = md5.digest('hex');
  // Fetch a user collection
  var collection = this.collection(DbCommand.SYSTEM_USER_COLLECTION);
  // Check if we are inserting the first user
  collection.count({}, function(err, count) {
    // We got an error (f.ex not authorized)
    if(err != null) return callback(err, null);
    // Check if the user exists and update i
    collection.find({user: username}, {dbName: options['dbName']}).toArray(function(err, documents) {
      // We got an error (f.ex not authorized)
      if(err != null) return callback(err, null);
      // Add command keys
      var commandOptions = errorOptions;
      commandOptions.dbName = options['dbName'];
      commandOptions.upsert = true;

      // We have a user, let's update the password or upsert if not
      collection.update({user: username},{$set: {user: username, pwd: userPassword}}, commandOptions, function(err, results) {
        if(count == 0 && err) {
          callback(null, [{user:username, pwd:userPassword}]);
        } else if(err) {
          callback(err, null)
        } else {
          callback(null, [{user:username, pwd:userPassword}]);
        }
      });
    });
  });
};

/**
 * Remove a user from a database
 *
 * Options
*  - **w**, {Number/String, > -1 || 'majority' || tag name} the write concern for the operation where < 1 is no acknowlegement of write and w >= 1, w = 'majority' or tag acknowledges the write
 *  - **wtimeout**, {Number, 0} set the timeout for waiting for write concern to finish (combines with w option)
 *  - **fsync**, (Boolean, default:false) write waits for fsync before returning
 *  - **journal**, (Boolean, default:false) write waits for journal sync before returning
 * 
 * Deprecated Options 
 *  - **safe** {true | {w:n, wtimeout:n} | {fsync:true}, default:false}, executes with a getLastError command returning the results of the command on MongoDB.
 *
 * @param {String} username username.
 * @param {Object} [options] additional options during update.
 * @param {Function} callback this will be called after executing this method. The first parameter will contain the Error object if an error occured, or null otherwise. While the second parameter will contain the results from removeUser or null if an error occured.
 * @return {null}
 * @api public
 */
Db.prototype.removeUser = function(username, options, callback) {
  var self = this;
  var args = Array.prototype.slice.call(arguments, 1);
  callback = args.pop();
  options = args.length ? args.shift() : {};

  // Figure out the safe mode settings
  var safe = self.safe != null && self.safe == false ? {w: 1} : self.safe;
  // Override with options passed in if applicable
  safe = options != null && options['safe'] != null ? options['safe'] : safe;
  // Ensure it's at least set to safe
  safe = safe == null ? {w: 1} : safe;

  // Fetch a user collection
  var collection = this.collection(DbCommand.SYSTEM_USER_COLLECTION);
  collection.findOne({user: username}, {dbName: options['dbName']}, function(err, user) {
    if(user != null) {
      // Add command keys
      var commandOptions = safe;
      commandOptions.dbName = options['dbName'];

      collection.remove({user: username}, commandOptions, function(err, result) {
        callback(err, true);
      });
    } else {
      callback(err, false);
    }
  });
};

/**
 * Creates a collection on a server pre-allocating space, need to create f.ex capped collections.
 *
 * Options
*  - **w**, {Number/String, > -1 || 'majority' || tag name} the write concern for the operation where < 1 is no acknowlegement of write and w >= 1, w = 'majority' or tag acknowledges the write
 *  - **wtimeout**, {Number, 0} set the timeout for waiting for write concern to finish (combines with w option)
 *  - **fsync**, (Boolean, default:false) write waits for fsync before returning
 *  - **journal**, (Boolean, default:false) write waits for journal sync before returning
 *  - **serializeFunctions** {Boolean, default:false}, serialize functions on the document.
 *  - **raw** {Boolean, default:false}, perform all operations using raw bson objects.
 *  - **pkFactory** {Object}, object overriding the basic ObjectID primary key generation.
 *  - **capped** {Boolean, default:false}, create a capped collection.
 *  - **size** {Number}, the size of the capped collection in bytes.
 *  - **max** {Number}, the maximum number of documents in the capped collection.
 *  - **autoIndexId** {Boolean, default:true}, create an index on the _id field of the document, True by default on MongoDB 2.2 or higher off for version < 2.2.
 *  - **readPreference** {String}, the prefered read preference (ReadPreference.PRIMARY, ReadPreference.PRIMARY_PREFERRED, ReadPreference.SECONDARY, ReadPreference.SECONDARY_PREFERRED, ReadPreference.NEAREST).
 *  - **strict**, (Boolean, default:false) throws and error if collection already exists
 * 
 * Deprecated Options 
 *  - **safe** {true | {w:n, wtimeout:n} | {fsync:true}, default:false}, executes with a getLastError command returning the results of the command on MongoDB.
 *
 * @param {String} collectionName the collection name we wish to access.
 * @param {Object} [options] returns option results.
 * @param {Function} callback this will be called after executing this method. The first parameter will contain the Error object if an error occured, or null otherwise. While the second parameter will contain the results from createCollection or null if an error occured.
 * @return {null}
 * @api public
 */
Db.prototype.createCollection = function(collectionName, options, callback) {
  var args = Array.prototype.slice.call(arguments, 1);
  callback = args.pop();
  options = args.length ? args.shift() : null;
  var self = this;

  // Figure out the safe mode settings
  var safe = self.safe != null && self.safe == false ? {w: 1} : self.safe;
  // Override with options passed in if applicable
  safe = options != null && options['safe'] != null ? options['safe'] : safe;
  // Ensure it's at least set to safe
  safe = safe == null ? {w: 1} : safe;

  // Check if we have the name
  this.collectionNames(collectionName, function(err, collections) {
    if(err != null) return callback(err, null);

    var found = false;
    collections.forEach(function(collection) {
      if(collection.name == self.databaseName + "." + collectionName) found = true;
    });

    // If the collection exists either throw an exception (if db in safe mode) or return the existing collection
    if(found && options && options.strict) {
      return callback(new Error("Collection " + collectionName + " already exists. Currently in safe mode."), null);
    } else if(found){
      try {
        var collection = new Collection(self, collectionName, self.pkFactory, options);
      } catch(err) {
        return callback(err, null);
      }
      return callback(null, collection);
    }

    // Create a new collection and return it
    self._executeQueryCommand(DbCommand.createCreateCollectionCommand(self, collectionName, options), {read:false, safe:safe}, function(err, result) {
      var document = result.documents[0];
      // If we have no error let's return the collection
      if(err == null && document.ok == 1) {
        try {
          var collection = new Collection(self, collectionName, self.pkFactory, options);
        } catch(err) {
          return callback(err, null);
        }
        return callback(null, collection);
      } else {
        if (null == err) err = utils.toError(document);
        callback(err, null);
      }
    });
  });
};

/**
 * Execute a command hash against MongoDB. This lets you acess any commands not available through the api on the server.
 *
 * @param {Object} selector the command hash to send to the server, ex: {ping:1}.
 * @param {Function} callback this will be called after executing this method. The command always return the whole result of the command as the second parameter.
 * @return {null}
 * @api public
 */
Db.prototype.command = function(selector, options, callback) {
  var args = Array.prototype.slice.call(arguments, 1);
  callback = args.pop();
  options = args.length ? args.shift() : {};

  // Set up the options
  var cursor = new Cursor(this
    , new Collection(this, DbCommand.SYSTEM_COMMAND_COLLECTION), selector, {}, {
      limit: -1, timeout: QueryCommand.OPTS_NO_CURSOR_TIMEOUT, dbName: options['dbName']
    });

  // Set read preference if we set one
  var readPreference = options['readPreference'] ? options['readPreference'] : false;

  // Ensure only commands who support read Prefrences are exeuted otherwise override and use Primary
  if(readPreference != false) {
    if(selector['group'] || selector['aggregate'] || selector['collStats'] || selector['dbStats']
      || selector['count'] || selector['distinct'] || selector['geoNear'] || selector['geoSearch'] || selector['geoWalk']
      || (selector['mapreduce'] && selector.out == 'inline')) {
      // Set the read preference
      cursor.setReadPreference(readPreference);
    } else {
      cursor.setReadPreference(ReadPreference.PRIMARY);
    }
  }

  // Return the next object
  cursor.nextObject(callback);
};

/**
 * Drop a collection from the database, removing it permanently. New accesses will create a new collection.
 *
 * @param {String} collectionName the name of the collection we wish to drop.
 * @param {Function} callback this will be called after executing this method. The first parameter will contain the Error object if an error occured, or null otherwise. While the second parameter will contain the results from dropCollection or null if an error occured.
 * @return {null}
 * @api public
 */
Db.prototype.dropCollection = function(collectionName, callback) {
  var self = this;
  callback || (callback = function(){});

  // Drop the collection
  this._executeQueryCommand(DbCommand.createDropCollectionCommand(this, collectionName), function(err, result) {
    if(err == null && result.documents[0].ok == 1) {
      return callback(null, true);
    }

    if(null == err) err = utils.toError(result.documents[0]);
    callback(err, null);
  });
};

/**
 * Rename a collection.
 * 
 * Options
 *  - **dropTarget** {Boolean, default:false}, drop the target name collection if it previously exists.
 *
 * @param {String} fromCollection the name of the current collection we wish to rename.
 * @param {String} toCollection the new name of the collection.
 * @param {Object} [options] returns option results.
 * @param {Function} callback this will be called after executing this method. The first parameter will contain the Error object if an error occured, or null otherwise. While the second parameter will contain the results from renameCollection or null if an error occured.
 * @return {null}
 * @api public
 */
Db.prototype.renameCollection = function(fromCollection, toCollection, options, callback) {
  var self = this;

  if(typeof options == 'function') {
    callback = options;
    options = {}
  }

  callback || (callback = function(){});
  // Execute the command, return the new renamed collection if successful
  this._executeQueryCommand(DbCommand.createRenameCollectionCommand(this, fromCollection, toCollection, options), function(err, result) {
    if(err == null && result.documents[0].ok == 1) {
      return callback(null, new Collection(self, toCollection, self.pkFactory));
    }

    if(null == err) err = utils.toError(result.documents[0]);
    callback(err, null);
  });
};

/**
 * Return last error message for the given connection, note options can be combined.
 *
 * Options
 *  - **fsync** {Boolean, default:false}, option forces the database to fsync all files before returning.
 *  - **j** {Boolean, default:false}, awaits the journal commit before returning, > MongoDB 2.0.
 *  - **w** {Number}, until a write operation has been replicated to N servers.
 *  - **wtimeout** {Number}, number of miliseconds to wait before timing out.
 *
 * Connection Options
 *  - **connection** {Connection}, fire the getLastError down a specific connection.
 *
 * @param {Object} [options] returns option results.
 * @param {Object} [connectionOptions] returns option results.
 * @param {Function} callback this will be called after executing this method. The first parameter will contain the Error object if an error occured, or null otherwise. While the second parameter will contain the results from lastError or null if an error occured.
 * @return {null}
 * @api public
 */
Db.prototype.lastError = function(options, connectionOptions, callback) {
  // Unpack calls
  var args = Array.prototype.slice.call(arguments, 0);
  callback = args.pop();
  options = args.length ? args.shift() : {};
  connectionOptions = args.length ? args.shift() : {};

  this._executeQueryCommand(DbCommand.createGetLastErrorCommand(options, this), connectionOptions, function(err, error) {
    callback(err, error && error.documents);
  });
};

/**
 * Legacy method calls.
 *
 * @ignore
 * @api private
 */
Db.prototype.error = Db.prototype.lastError;
Db.prototype.lastStatus = Db.prototype.lastError;

/**
 * Return all errors up to the last time db reset_error_history was called.
 *
 * Options
 *  - **connection** {Connection}, fire the getLastError down a specific connection.
 *
 * @param {Object} [options] returns option results.
 * @param {Function} callback this will be called after executing this method. The first parameter will contain the Error object if an error occured, or null otherwise. While the second parameter will contain the results from previousErrors or null if an error occured.
 * @return {null}
 * @api public
 */
Db.prototype.previousErrors = function(options, callback) {
  // Unpack calls
  var args = Array.prototype.slice.call(arguments, 0);
  callback = args.pop();
  options = args.length ? args.shift() : {};

  this._executeQueryCommand(DbCommand.createGetPreviousErrorsCommand(this), options, function(err, error) {
    callback(err, error.documents);
  });
};

/**
 * Runs a command on the database.
 * @ignore
 * @api private
 */
Db.prototype.executeDbCommand = function(command_hash, options, callback) {
  if(callback == null) { callback = options; options = {}; }
  this._executeQueryCommand(DbCommand.createDbSlaveOkCommand(this, command_hash, options), options, callback);
};

/**
 * Runs a command on the database as admin.
 * @ignore
 * @api private
 */
Db.prototype.executeDbAdminCommand = function(command_hash, options, callback) {
  if(callback == null) { callback = options; options = {}; }
  this._executeQueryCommand(DbCommand.createAdminDbCommand(this, command_hash), options, callback);
};

/**
 * Resets the error history of the mongo instance.
 *
 * Options
 *  - **connection** {Connection}, fire the getLastError down a specific connection.
 *
 * @param {Object} [options] returns option results.
 * @param {Function} callback this will be called after executing this method. The first parameter will contain the Error object if an error occured, or null otherwise. While the second parameter will contain the results from resetErrorHistory or null if an error occured.
 * @return {null}
 * @api public
 */
Db.prototype.resetErrorHistory = function(options, callback) {
  // Unpack calls
  var args = Array.prototype.slice.call(arguments, 0);
  callback = args.pop();
  options = args.length ? args.shift() : {};

  this._executeQueryCommand(DbCommand.createResetErrorHistoryCommand(this), options, function(err, error) {
    callback(err, error.documents);
  });
};

/**
 * Creates an index on the collection.
 *
 * Options
*  - **w**, {Number/String, > -1 || 'majority' || tag name} the write concern for the operation where < 1 is no acknowlegement of write and w >= 1, w = 'majority' or tag acknowledges the write
 *  - **wtimeout**, {Number, 0} set the timeout for waiting for write concern to finish (combines with w option)
 *  - **fsync**, (Boolean, default:false) write waits for fsync before returning
 *  - **journal**, (Boolean, default:false) write waits for journal sync before returning
 *  - **unique** {Boolean, default:false}, creates an unique index.
 *  - **sparse** {Boolean, default:false}, creates a sparse index.
 *  - **background** {Boolean, default:false}, creates the index in the background, yielding whenever possible.
 *  - **dropDups** {Boolean, default:false}, a unique index cannot be created on a key that has pre-existing duplicate values. If you would like to create the index anyway, keeping the first document the database indexes and deleting all subsequent documents that have duplicate value
 *  - **min** {Number}, for geospatial indexes set the lower bound for the co-ordinates.
 *  - **max** {Number}, for geospatial indexes set the high bound for the co-ordinates.
 *  - **v** {Number}, specify the format version of the indexes.
 *  - **expireAfterSeconds** {Number}, allows you to expire data on indexes applied to a data (MongoDB 2.2 or higher)
 *  - **name** {String}, override the autogenerated index name (useful if the resulting name is larger than 128 bytes)
 * 
 * Deprecated Options 
 *  - **safe** {true | {w:n, wtimeout:n} | {fsync:true}, default:false}, executes with a getLastError command returning the results of the command on MongoDB.
 *
 *
 * @param {String} collectionName name of the collection to create the index on.
 * @param {Object} fieldOrSpec fieldOrSpec that defines the index.
 * @param {Object} [options] additional options during update.
 * @param {Function} callback this will be called after executing this method. The first parameter will contain the Error object if an error occured, or null otherwise. While the second parameter will contain the results from createIndex or null if an error occured.
 * @return {null}
 * @api public
 */
Db.prototype.createIndex = function(collectionName, fieldOrSpec, options, callback) {
  var self = this;
  var args = Array.prototype.slice.call(arguments, 2);
  callback = args.pop();
  options = args.length ? args.shift() : {};
  options = typeof callback === 'function' ? options : callback;
  options = options == null ? {} : options;

  // Get the error options
  var errorOptions = _getWriteConcern(this, options, callback);
  // Create command
  var command = DbCommand.createCreateIndexCommand(this, collectionName, fieldOrSpec, options);
  // Default command options
  var commandOptions = {};

  // If we have error conditions set handle them
  if(_hasWriteConcern(errorOptions) && typeof callback == 'function') {
    // Insert options
    commandOptions['read'] = false;
    // If we have safe set set async to false
    if(errorOptions == null) commandOptions['async'] = true;

    // Set safe option
    commandOptions['safe'] = errorOptions;
    // If we have an error option
    if(typeof errorOptions == 'object') {
      var keys = Object.keys(errorOptions);
      for(var i = 0; i < keys.length; i++) {
        commandOptions[keys[i]] = errorOptions[keys[i]];
      }
    }

    // Execute insert command
    this._executeInsertCommand(command, commandOptions, function(err, result) {
      if(err != null) return callback(err, null);

      result = result && result.documents;
      if (result[0].err) {
        callback(utils.toError(result[0]));
      } else {
        callback(null, command.documents[0].name);
      }
    });
  } else if(_hasWriteConcern(errorOptions) && callback == null) {
    throw new Error("Cannot use a writeConcern without a provided callback");
  } else {
    // Execute insert command
    var result = this._executeInsertCommand(command, commandOptions);
    // If no callback just return
    if(!callback) return;
    // If error return error
    if(result instanceof Error) {
      return callback(result);
    }
    // Otherwise just return
    return callback(null, null);
  }
};

/**
 * Ensures that an index exists, if it does not it creates it
 *
 * Options
*  - **w**, {Number/String, > -1 || 'majority' || tag name} the write concern for the operation where < 1 is no acknowlegement of write and w >= 1, w = 'majority' or tag acknowledges the write
 *  - **wtimeout**, {Number, 0} set the timeout for waiting for write concern to finish (combines with w option)
 *  - **fsync**, (Boolean, default:false) write waits for fsync before returning
 *  - **journal**, (Boolean, default:false) write waits for journal sync before returning
 *  - **unique** {Boolean, default:false}, creates an unique index.
 *  - **sparse** {Boolean, default:false}, creates a sparse index.
 *  - **background** {Boolean, default:false}, creates the index in the background, yielding whenever possible.
 *  - **dropDups** {Boolean, default:false}, a unique index cannot be created on a key that has pre-existing duplicate values. If you would like to create the index anyway, keeping the first document the database indexes and deleting all subsequent documents that have duplicate value
 *  - **min** {Number}, for geospatial indexes set the lower bound for the co-ordinates.
 *  - **max** {Number}, for geospatial indexes set the high bound for the co-ordinates.
 *  - **v** {Number}, specify the format version of the indexes.
 *  - **expireAfterSeconds** {Number}, allows you to expire data on indexes applied to a data (MongoDB 2.2 or higher)
 *  - **name** {String}, override the autogenerated index name (useful if the resulting name is larger than 128 bytes)
 * 
 * Deprecated Options 
 *  - **safe** {true | {w:n, wtimeout:n} | {fsync:true}, default:false}, executes with a getLastError command returning the results of the command on MongoDB.
 *
 * @param {String} collectionName name of the collection to create the index on.
 * @param {Object} fieldOrSpec fieldOrSpec that defines the index.
 * @param {Object} [options] additional options during update.
 * @param {Function} callback this will be called after executing this method. The first parameter will contain the Error object if an error occured, or null otherwise. While the second parameter will contain the results from ensureIndex or null if an error occured.
 * @return {null}
 * @api public
 */
Db.prototype.ensureIndex = function(collectionName, fieldOrSpec, options, callback) {
  var self = this;

  if (typeof callback === 'undefined' && typeof options === 'function') {
    callback = options;
    options = {};
  }

  if (options == null) {
    options = {};
  }

  // Get the error options
  var errorOptions = _getWriteConcern(this, options, callback);
  // Make sure we don't try to do a write concern without a callback
  if(_hasWriteConcern(errorOptions) && callback == null)
    throw new Error("Cannot use a writeConcern without a provided callback");
  // Create command
  var command = DbCommand.createCreateIndexCommand(this, collectionName, fieldOrSpec, options);
  var index_name = command.documents[0].name;

  // Default command options
  var commandOptions = {};
  // Check if the index allready exists
  this.indexInformation(collectionName, function(err, collectionInfo) {
    if(err != null) return callback(err, null);

    if(!collectionInfo[index_name])  {
      // If we have error conditions set handle them
      if(_hasWriteConcern(errorOptions) && typeof callback == 'function') {
        // Insert options
        commandOptions['read'] = false;
        // If we have safe set set async to false
        if(errorOptions == null) commandOptions['async'] = true;

        // If we have an error option
        if(typeof errorOptions == 'object') {
          var keys = Object.keys(errorOptions);
          for(var i = 0; i < keys.length; i++) {
            commandOptions[keys[i]] = errorOptions[keys[i]];
          }
        }

        if(typeof callback === 'function' 
          && commandOptions.w < 1 && !commandOptions.fsync && !commandOptions.journal) {
          commandOptions.w = 1;
        }

        self._executeInsertCommand(command, commandOptions, function(err, result) {
          // Only callback if we have one specified
          if(typeof callback === 'function') {
            if(err != null) return callback(err, null);

            result = result && result.documents;
            if (result[0].err) {
              callback(utils.toError(result[0]));
            } else {
              callback(null, command.documents[0].name);
            }
          }
        });
      } else {
        // Execute insert command
        var result = self._executeInsertCommand(command, commandOptions);
        // If no callback just return
        if(!callback) return;
        // If error return error
        if(result instanceof Error) {
          return callback(result);
        }
        // Otherwise just return
        return callback(null, index_name);
      }
    } else {
      if(typeof callback === 'function') return callback(null, index_name);
    }
  });
};

/**
 * Returns the information available on allocated cursors.
 *
 * Options
 *  - **readPreference** {String}, the prefered read preference (ReadPreference.PRIMARY, ReadPreference.PRIMARY_PREFERRED, ReadPreference.SECONDARY, ReadPreference.SECONDARY_PREFERRED, ReadPreference.NEAREST).
 *
 * @param {Object} [options] additional options during update.
 * @param {Function} callback this will be called after executing this method. The first parameter will contain the Error object if an error occured, or null otherwise. While the second parameter will contain the results from cursorInfo or null if an error occured.
 * @return {null}
 * @api public
 */
Db.prototype.cursorInfo = function(options, callback) {
  var args = Array.prototype.slice.call(arguments, 0);
  callback = args.pop();
  options = args.length ? args.shift() : {};

  this._executeQueryCommand(DbCommand.createDbSlaveOkCommand(this, {'cursorInfo':1}), options, function(err, result) {
    callback(err, result.documents[0]);
  });
};

/**
 * Drop an index on a collection.
 *
 * @param {String} collectionName the name of the collection where the command will drop an index.
 * @param {String} indexName name of the index to drop.
 * @param {Function} callback this will be called after executing this method. The first parameter will contain the Error object if an error occured, or null otherwise. While the second parameter will contain the results from dropIndex or null if an error occured.
 * @return {null}
 * @api public
 */
Db.prototype.dropIndex = function(collectionName, indexName, callback) {  
  this._executeQueryCommand(DbCommand.createDropIndexCommand(this, collectionName, indexName), callback);
};

/**
 * Reindex all indexes on the collection
 * Warning: reIndex is a blocking operation (indexes are rebuilt in the foreground) and will be slow for large collections.
 *
 * @param {String} collectionName the name of the collection.
 * @param {Function} callback this will be called after executing this method. The first parameter will contain the Error object if an error occured, or null otherwise. While the second parameter will contain the results from reIndex or null if an error occured.
 * @api public
**/
Db.prototype.reIndex = function(collectionName, callback) {
  this._executeQueryCommand(DbCommand.createReIndexCommand(this, collectionName), function(err, result) {
    if(err != null) {
      callback(err, false);
    } else if(result.documents[0].errmsg == null) {
      callback(null, true);
    } else {
      callback(new Error(result.documents[0].errmsg), false);
    }
  });
};

/**
 * Retrieves this collections index info.
 *
 * Options
 *  - **full** {Boolean, default:false}, returns the full raw index information.
 *  - **readPreference** {String}, the preferred read preference ((Server.PRIMARY, Server.PRIMARY_PREFERRED, Server.SECONDARY, Server.SECONDARY_PREFERRED, Server.NEAREST).
 *
 * @param {String} collectionName the name of the collection.
 * @param {Object} [options] additional options during update.
 * @param {Function} callback this will be called after executing this method. The first parameter will contain the Error object if an error occured, or null otherwise. While the second parameter will contain the results from indexInformation or null if an error occured.
 * @return {null}
 * @api public
 */
Db.prototype.indexInformation = function(collectionName, options, callback) {
  if(typeof callback === 'undefined') {
    if(typeof options === 'undefined') {
      callback = collectionName;
      collectionName = null;
    } else {
      callback = options;
    }
    options = {};
  }

  // If we specified full information
  var full = options['full'] == null ? false : options['full'];
  // Build selector for the indexes
  var selector = collectionName != null ? {ns: (this.databaseName + "." + collectionName)} : {};

  // Set read preference if we set one
  var readPreference = options['readPreference'] ? options['readPreference'] : ReadPreference.PRIMARY;

  // Iterate through all the fields of the index
  this.collection(DbCommand.SYSTEM_INDEX_COLLECTION, function(err, collection) {
    // Perform the find for the collection
    collection.find(selector).setReadPreference(readPreference).toArray(function(err, indexes) {
      if(err != null) return callback(err, null);
      // Contains all the information
      var info = {};

      // if full defined just return all the indexes directly
      if(full) return callback(null, indexes);

      // Process all the indexes
      for(var i = 0; i < indexes.length; i++) {
        var index = indexes[i];
        // Let's unpack the object
        info[index.name] = [];
        for(var name in index.key) {
          info[index.name].push([name, index.key[name]]);
        }
      }

      // Return all the indexes
      callback(null, info);
    });
  });
};

/**
 * Drop a database.
 *
 * @param {Function} callback this will be called after executing this method. The first parameter will contain the Error object if an error occured, or null otherwise. While the second parameter will contain the results from dropDatabase or null if an error occured.
 * @return {null}
 * @api public
 */
Db.prototype.dropDatabase = function(callback) {
  var self = this;

  this._executeQueryCommand(DbCommand.createDropDatabaseCommand(this), function(err, result) {
    if(err == null && result.documents[0].ok == 1) {
      callback(null, true);
    } else {
      if(err) {
        callback(err, false);
      } else {
        callback(utils.toError(result.documents[0]), false);
      }
    }
  });
};

/**
 * Get all the db statistics.
 *
 * Options
 *  - **scale** {Number}, divide the returned sizes by scale value.
 *  - **readPreference** {String}, the preferred read preference ((Server.PRIMARY, Server.PRIMARY_PREFERRED, Server.SECONDARY, Server.SECONDARY_PREFERRED, Server.NEAREST).
 *
 * @param {Objects} [options] options for the stats command
 * @param {Function} callback this will be called after executing this method. The first parameter will contain the Error object if an error occured, or null otherwise. While the second parameter will contain the results from stats or null if an error occured.
 * @return {null}
 * @api public
 */
Db.prototype.stats = function stats(options, callback) {
  var args = Array.prototype.slice.call(arguments, 0);
  callback = args.pop();
  // Fetch all commands
  options = args.length ? args.shift() : {};

  // Build command object
  var commandObject = {
    dbStats:this.collectionName,
  }

  // Check if we have the scale value
  if(options['scale'] != null) commandObject['scale'] = options['scale'];

  // Execute the command
  this.command(commandObject, options, callback);
}

/**
 * @ignore
 */
var __executeQueryCommand = function(self, db_command, options, callback) {
  // Options unpacking
  var read = options['read'] != null ? options['read'] : false;
  var raw = options['raw'] != null ? options['raw'] : self.raw;
  var onAll = options['onAll'] != null ? options['onAll'] : false;
  var specifiedConnection = options['connection'] != null ? options['connection'] : null;

  // Correct read preference to default primary if set to false, null or primary
  if(!(typeof read == 'object') && read._type == 'ReadPreference') {
    read = (read == null || read == 'primary' || read == false) ? ReadPreference.PRIMARY : read;
    if(!ReadPreference.isValid(read)) return callback(new Error("Illegal readPreference mode specified, " + read));
  } else if(typeof read == 'object' && read._type == 'ReadPreference') {
    if(!read.isValid()) return callback(new Error("Illegal readPreference mode specified, " + read.mode));
  }

  // If we have a read preference set and we are a mongos pass the read preference on to the mongos instance,
  if(self.serverConfig.isMongos() && read != null && read != false) {
    db_command.setMongosReadPreference(read);
  }

  // If we got a callback object
  if(typeof callback === 'function' && !onAll) {
    // Override connection if we passed in a specific connection
    var connection = specifiedConnection != null ? specifiedConnection : null;

    if(connection instanceof Error) return callback(connection, null);

    // Fetch either a reader or writer dependent on the specified read option if no connection
    // was passed in
    if(connection == null) {
      connection = read == null || read == 'primary' || read == false ? self.serverConfig.checkoutWriter(true) : self.serverConfig.checkoutReader(read);
    }

    // Ensure we have a valid connection
    if(connection == null) {
      return callback(new Error("no open connections"));
    } else if(connection instanceof Error || connection['message'] != null) {
      return callback(connection);
    }

    // Exhaust Option
    var exhaust = options.exhaust || false;
    // Register the handler in the data structure
    self.serverConfig._registerHandler(db_command, raw, connection, exhaust, callback);
    // Write the message out and handle any errors if there are any
    connection.write(db_command, function(err) {
      if(err != null) {
        // Call the handler with an error
        self.serverConfig._callHandler(db_command.getRequestId(), null, err);
      }
    });
  } else if(typeof callback === 'function' && onAll) {
    var connections = self.serverConfig.allRawConnections();
    var numberOfEntries = connections.length;
    // Go through all the connections
    for(var i = 0; i < connections.length; i++) {
      // Fetch a connection
      var connection = connections[i];

      // Ensure we have a valid connection
      if(connection == null) {
        return callback(new Error("no open connections"));
      } else if(connection instanceof Error) {
        return callback(connection);
      }

      // Register the handler in the data structure
      self.serverConfig._registerHandler(db_command, raw, connection, callback);
      // Write the message out
      connection.write(db_command, function(err) {
        // Adjust the number of entries we need to process
        numberOfEntries = numberOfEntries - 1;
        // Remove listener
        if(err != null) {
          // Clean up listener and return error
          self.serverConfig._removeHandler(db_command.getRequestId());
        }

        // No more entries to process callback with the error
        if(numberOfEntries <= 0) {
          callback(err);
        }
      });

      // Update the db_command request id
      db_command.updateRequestId();
    }
  } else {
    // Fetch either a reader or writer dependent on the specified read option
    var connection = read == null || read == 'primary' || read == false ? self.serverConfig.checkoutWriter(true) : self.serverConfig.checkoutReader(read);
    // Override connection if needed
    connection = specifiedConnection != null ? specifiedConnection : connection;
    // Ensure we have a valid connection
    if(connection == null || connection instanceof Error || connection['message'] != null) return null;
    // Write the message out
    connection.write(db_command, function(err) {
      if(err != null) {
        // Emit the error
        self.emit("error", err);
      }
    });
  }
}

/**
 * @ignore
 */
var __retryCommandOnFailure = function(self, retryInMilliseconds, numberOfTimes, command, db_command, options, callback) {
  if(this._state == 'connected' || this._state == 'disconnected') this._state = 'connecting';
  // Number of retries done
  var numberOfRetriesDone = numberOfTimes;
  // Retry function, execute once
  var retryFunction = function(_self, _numberOfRetriesDone, _retryInMilliseconds, _numberOfTimes, _command, _db_command, _options, _callback) {
    _self.serverConfig.connect(_self, {}, function(err, result, _serverConfig) {
      if(_options) delete _options['connection'];

      // Adjust the number of retries left
      _numberOfRetriesDone = _numberOfRetriesDone - 1;
      // Definitively restart
      if(err != null && _numberOfRetriesDone > 0) {
        _self._state = 'connecting';
        // Close the server config
        _serverConfig.close(function(err) {
          // Retry the connect
          setTimeout(function() {
            retryFunction(_self, _numberOfRetriesDone, _retryInMilliseconds, _numberOfTimes, _command, _db_command, _options, _callback);
          }, _retryInMilliseconds);
        });
      } else if(err != null && _numberOfRetriesDone <= 0) {
        _self._state = 'disconnected';
        // Force close the current connections
        _serverConfig.close(function(_err) {
          // Force close the current connections
          if(typeof _callback == 'function') _callback(err, null);
        });
      } else if(err == null && _self.serverConfig.isConnected() == true && Array.isArray(_self.auths) && _self.auths.length > 0) {
        _self._state = 'connected';
        // Get number of auths we need to execute
        var numberOfAuths = _self.auths.length;
        // Apply all auths
        for(var i = 0; i < _self.auths.length; i++) {
          _self.authenticate(_self.auths[i].username, _self.auths[i].password, {'authdb':_self.auths[i].authdb}, function(err, authenticated) {
            numberOfAuths = numberOfAuths - 1;

            // If we have no more authentications to replay
            if(numberOfAuths == 0) {
              if(err != null || !authenticated) {
                if(typeof _callback == 'function') _callback(err, null);
                return;
              } else {
                // Execute command
                command(_self, _db_command, _options, _callback);
                // Execute all the commands
                if(_self.commands.length > 0) _execute_queued_command(_self);
              }
            }
          });
        }
      } else if(err == null && _self.serverConfig.isConnected() == true) {
        _self._state = 'connected';

        // Execute command
        command(_self, _db_command, _options, _callback);        
  
        processor(function() {
          // Execute any backed up commands
          while(_self.commands.length > 0) {
            // Fetch the command
            var command = _self.commands.shift();
            // Execute based on type
            if(command['type'] == 'query') {
              __executeQueryCommand(_self, command['db_command'], command['options'], command['callback']);
            } else if(command['type'] == 'insert') {
              __executeInsertCommand(_self, command['db_command'], command['options'], command['callback']);
            }
          }
        });
      } else {
        _self._state = 'connecting';
        // Force close the current connections
        _serverConfig.close(function(err) {
        // _self.serverConfig.close(function(err) {
          // Retry the connect
          setTimeout(function() {
            retryFunction(_self, _numberOfRetriesDone, _retryInMilliseconds, _numberOfTimes, _command, _db_command, _options, _callback);
          }, _retryInMilliseconds);
        });
      }
    });
  };

  // Execute function first time
  retryFunction(self, numberOfRetriesDone, retryInMilliseconds, numberOfTimes, command, db_command, options, callback);
}

/**
 * Execute db query command (not safe)
 * @ignore
 * @api private
 */
Db.prototype._executeQueryCommand = function(db_command, options, callback) {
  var self = this;

  // Unpack the parameters
  if (typeof callback === 'undefined') {
    callback = options;
    options = {};
  }

  // fast fail option used for HA, no retry
  var failFast = options['failFast'] != null
    ? options['failFast']
    : false;

  // Check if the user force closed the command
  if(this._applicationClosed) {
    var err = new Error("db closed by application");
    if('function' == typeof callback) {
      return callback(err, null);
    } else {
      throw err;
    }
  }

  var config = this.serverConfig;
  // If the pool is not connected, attemp to reconnect to send the message
  if(this._state == 'connecting' && config.autoReconnect && !failFast) {
    return processor(function() {
      self.commands.push({
        type: 'query',
        db_command: db_command,
        options: options,
        callback: callback
      });
    })
  }

  if(!failFast && !config.isConnected(options.read) && config.autoReconnect 
      && (options.read == null 
        || options.read == false
        || options.read == ReadPreference.PRIMARY 
        || config.checkoutReader(options.read) == null)) {
    this._state = 'connecting';
    return __retryCommandOnFailure(this,
                                   this.retryMiliSeconds,
                                   this.numberOfRetries,
                                   __executeQueryCommand,
                                   db_command,
                                   options,
                                   callback);
  }

  if(!config.isConnected(options.read) && !config.autoReconnect && callback) {
    // Fire an error to the callback if we are not connected
    // and don't reconnect.
    return callback(new Error("no open connections"), null);
  }

  __executeQueryCommand(self, db_command, options, function (err, result, conn) {
    if(callback) callback(err, result, conn);
  });

};

/**
 * @ignore
 */
var __executeInsertCommand = function(self, db_command, options, callback) {
  // Always checkout a writer for this kind of operations
  var connection = self.serverConfig.checkoutWriter();
  // Get safe mode
  var safe = options['safe'] != null ? options['safe'] : false;
  var raw = options['raw'] != null ? options['raw'] : self.raw;
  var specifiedConnection = options['connection'] != null ? options['connection'] : null;
  // Override connection if needed
  connection = specifiedConnection != null ? specifiedConnection : connection;

  // Ensure we have a valid connection
  if(typeof callback === 'function') {
    // Ensure we have a valid connection
    if(connection == null) {
      return callback(new Error("no open connections"));
    } else if(connection instanceof Error) {
      return callback(connection);
    }

    var errorOptions = _getWriteConcern(self, options, callback);
    if(errorOptions.w > 0 || errorOptions.w == 'majority' || errorOptions.j || errorOptions.journal || errorOptions.fsync) {      
      // db command is now an array of commands (original command + lastError)
      db_command = [db_command, DbCommand.createGetLastErrorCommand(safe, self)];
      // Register the handler in the data structure
      self.serverConfig._registerHandler(db_command[1], raw, connection, callback);      
    }
  }

  // If we have no callback and there is no connection
  if(connection == null) return null;
  if(connection instanceof Error && typeof callback == 'function') return callback(connection, null);
  if(connection instanceof Error) return null;
  if(connection == null && typeof callback == 'function') return callback(new Error("no primary server found"), null);

  // Write the message out
  connection.write(db_command, function(err) {
    // Return the callback if it's not a safe operation and the callback is defined
    if(typeof callback === 'function' && (safe == null || safe == false)) {
      // Perform the callback
      callback(err, null);
    } else if(typeof callback === 'function') {
      // Call the handler with an error
      self.serverConfig._callHandler(db_command[1].getRequestId(), null, err);
    } else if(typeof callback == 'function' && safe && safe.w == -1) {
      // Call the handler with no error
      self.serverConfig._callHandler(db_command[1].getRequestId(), null, null);
    } else if(!safe || safe.w == -1) {
      self.emit("error", err);
    }
  });
}

/**
 * Execute an insert Command
 * @ignore
 * @api private
 */
Db.prototype._executeInsertCommand = function(db_command, options, callback) {
  var self = this;

  // Unpack the parameters
  if(callback == null && typeof options === 'function') {
    callback = options;
    options = {};
  }

  // Ensure options are not null
  options = options == null ? {} : options;

  // Check if the user force closed the command
  if(this._applicationClosed) {
    if(typeof callback == 'function') {
      return callback(new Error("db closed by application"), null);
    } else {
      throw new Error("db closed by application");
    }
  }

  // If the pool is not connected, attemp to reconnect to send the message
  if(self._state == 'connecting' && this.serverConfig.autoReconnect) {
    processor(function() {
      self.commands.push({type:'insert', 'db_command':db_command, 'options':options, 'callback':callback});
    })
  } else if(!this.serverConfig.isConnected() && this.serverConfig.autoReconnect) {
    this._state = 'connecting';
    // Retry command
    __retryCommandOnFailure(this, this.retryMiliSeconds, this.numberOfRetries, __executeInsertCommand, db_command, options, callback);
  } else if(!this.serverConfig.isConnected() && !this.serverConfig.autoReconnect && callback) {
    // Fire an error to the callback if we are not connected and don't do reconnect
    if(callback) callback(new Error("no open connections"), null);
  } else {
    __executeInsertCommand(self, db_command, options, callback);
  }
}

/**
 * Update command is the same
 * @ignore
 * @api private
 */
Db.prototype._executeUpdateCommand = Db.prototype._executeInsertCommand;
/**
 * Remove command is the same
 * @ignore
 * @api private
 */
Db.prototype._executeRemoveCommand = Db.prototype._executeInsertCommand;

/**
 * Wrap a Mongo error document into an Error instance.
 * Deprecated. Use utils.toError instead.
 *
 * @ignore
 * @api private
 * @deprecated
 */
Db.prototype.wrap = utils.toError;

/**
 * Default URL
 *
 * @classconstant DEFAULT_URL
 **/
Db.DEFAULT_URL = 'mongodb://localhost:27017/default';

/**
 * Connect to MongoDB using a url as documented at
 *
 *  docs.mongodb.org/manual/reference/connection-string/
 *
 * Options
 *  - **uri_decode_auth** {Boolean, default:false} uri decode the user name and password for authentication
 *  - **db** {Object, default: null} a hash off options to set on the db object, see **Db constructor**
 *  - **server** {Object, default: null} a hash off options to set on the server objects, see **Server** constructor**
 *  - **replSet** {Object, default: null} a hash off options to set on the replSet object, see **ReplSet** constructor**
 *  - **mongos** {Object, default: null} a hash off options to set on the mongos object, see **Mongos** constructor**
 *
 * @param {String} url connection url for MongoDB.
 * @param {Object} [options] optional options for insert command
 * @param {Function} callback this will be called after executing this method. The first parameter will contain the Error object if an error occured, or null otherwise. While the second parameter will contain the db instance or null if an error occured.
 * @return {null}
 * @api public
 */
Db.connect = function(url, options, callback) {
  var args = Array.prototype.slice.call(arguments, 1);
  callback = typeof args[args.length - 1] == 'function' ? args.pop() : null;
  options = args.length ? args.shift() : null;
  options = options || {};
  var serverOptions = options.server || {};
  var mongosOptions = options.mongos || {};
  var replSetServersOptions = options.replSet || options.replSetServers || {};
  var dbOptions = options.db || {};

  // If callback is null throw an exception
  if(callback == null) throw new Error("no callback function provided");

  // Parse the string
  var object = parse(url);
  // Merge in any options for db in options object
  if(dbOptions) {
    for(var name in dbOptions) object.db_options[name] = dbOptions[name];
  }

  // Merge in any options for server in options object
  if(serverOptions) {
    for(var name in serverOptions) object.server_options[name] = serverOptions[name];
  }

  // Merge in any replicaset server options
  if(replSetServersOptions) {
    for(var name in replSetServersOptions) object.rs_options[name] = replSetServersOptions[name];    
  }

  // Merge in any replicaset server options
  if(mongosOptions) {
    for(var name in mongosOptions) object.mongos_options[name] = mongosOptions[name];    
  }

  // We need to ensure that the list of servers are only either direct members or mongos
  // they cannot be a mix of monogs and mongod's
  var totalNumberOfServers = object.servers.length;
  var totalNumberOfMongosServers = 0;
  var totalNumberOfMongodServers = 0;
  var serverConfig = null;
  var errorServers = {};

  // Failure modes
  if(object.servers.length == 0) throw new Error("connection string must contain at least one seed host");

  // If we have no db setting for the native parser try to set the c++ one first
  object.db_options.native_parser = _setNativeParser(object.db_options);
  // If no auto_reconnect is set, set it to true as default for single servers
  if(typeof object.server_options.auto_reconnect != 'boolean') {
    object.server_options.auto_reconnect = true;
  }

  // If we have more than a server, it could be replicaset or mongos list
  // need to verify that it's one or the other and fail if it's a mix
  // Connect to all servers and run ismaster
  for(var i = 0; i < object.servers.length; i++) {
    // Set up socket options
    var _server_options = {poolSize:1, socketOptions:{connectTimeoutMS:1000}, auto_reconnect:false};

    // Ensure we have ssl setup for the servers
    if(object.rs_options.ssl) {
      _server_options.ssl = object.rs_options.ssl;
      _server_options.sslValidate = object.rs_options.sslValidate;
      _server_options.sslCA = object.rs_options.sslCA;
      _server_options.sslCert = object.rs_options.sslCert;
      _server_options.sslKey = object.rs_options.sslKey;
      _server_options.sslPass = object.rs_options.sslPass;
    } else if(object.server_options.ssl) {
      _server_options.ssl = object.server_options.ssl;
      _server_options.sslValidate = object.server_options.sslValidate;
      _server_options.sslCA = object.server_options.sslCA;
      _server_options.sslCert = object.server_options.sslCert;
      _server_options.sslKey = object.server_options.sslKey;
      _server_options.sslPass = object.server_options.sslPass;
    }

    // Set up the Server object
    var _server = object.servers[i].domain_socket 
        ? new Server(object.servers[i].domain_socket, _server_options)
        : new Server(object.servers[i].host, object.servers[i].port, _server_options);

    var connectFunction = function(__server) {      
      // Attempt connect
      new Db(object.dbName, __server, {safe:false, native_parser:false}).open(function(err, db) {
          // Update number of servers
          totalNumberOfServers = totalNumberOfServers - 1;          
          // If no error do the correct checks
          if(!err) {
            // Close the connection
            db.close(true);
            var isMasterDoc = db.serverConfig.isMasterDoc;
            // Check what type of server we have
            if(isMasterDoc.setName) totalNumberOfMongodServers++;
            if(isMasterDoc.msg && isMasterDoc.msg == "isdbgrid") totalNumberOfMongosServers++;
          } else {
            errorServers[__server.host + ":" + __server.port] = __server;
          }

          if(totalNumberOfServers == 0) {
            // If we have a mix of mongod and mongos, throw an error
            if(totalNumberOfMongosServers > 0 && totalNumberOfMongodServers > 0)
              return callback(new Error("cannot combine a list of replicaset seeds and mongos seeds"));
            
            if(totalNumberOfMongodServers == 0 && object.servers.length == 1) {
              var obj = object.servers[0];
              serverConfig = obj.domain_socket ? 
                  new Server(obj.domain_socket, object.server_options)
                : new Server(obj.host, obj.port, object.server_options);            
            } else if(totalNumberOfMongodServers > 0 || totalNumberOfMongosServers > 0) {
              var finalServers = object.servers
                .filter(function(serverObj) {
                  return errorServers[serverObj.host + ":" + serverObj.port] == null;
                })
                .map(function(serverObj) {
                    return new Server(serverObj.host, serverObj.port, object.server_options);
                });
              // Clean out any error servers
              errorServers = {};
              // Set up the final configuration
              if(totalNumberOfMongodServers > 0) {
                serverConfig = new ReplSet(finalServers, object.rs_options);                
              } else {
                serverConfig = new Mongos(finalServers, object.mongos_options);                         
              }
            }

            if(serverConfig == null) return callback(new Error("Could not locate any valid servers in initial seed list"));
            // Set up all options etc and connect to the database
            _finishConnecting(serverConfig, object, options, callback)
          }
        });        
    }

    // Wrap the context of the call
    connectFunction(_server);    
  }    
}

var _setNativeParser = function(db_options) {
  if(typeof db_options.native_parser == 'boolean') return db_options.native_parser;

  try {
    require('bson').BSONNative.BSON;
    return true;
  } catch(err) {
    return false;
  }
}

var _finishConnecting = function(serverConfig, object, options, callback) {
  // Safe settings
  var safe = {};
  // Build the safe parameter if needed
  if(object.db_options.journal) safe.j = object.db_options.journal;
  if(object.db_options.w) safe.w = object.db_options.w;
  if(object.db_options.fsync) safe.fsync = object.db_options.fsync;
  if(object.db_options.wtimeoutMS) safe.wtimeout = object.db_options.wtimeoutMS;

  // If we have a read Preference set
  if(object.db_options.read_preference) {
    var readPreference = new ReadPreference(object.db_options.read_preference);
    // If we have the tags set up
    if(object.db_options.read_preference_tags)
      readPreference = new ReadPreference(object.db_options.read_preference, object.db_options.read_preference_tags);
    // Add the read preference
    object.db_options.readPreference = readPreference;
  }

  // No safe mode if no keys
  if(Object.keys(safe).length == 0) safe = false;

  // Add the safe object
  object.db_options.safe = safe;

  // Set up the db options
  var db = new Db(object.dbName, serverConfig, object.db_options);

  // Open the db
  db.open(function(err, db){
    if(err == null && object.auth){
      // What db to authenticate against
      var authentication_db = db;
      if(object.db_options && object.db_options.authSource) {
        authentication_db = db.db(object.db_options.authSource);
      }

      // Authenticate
      authentication_db.authenticate(object.auth.user, object.auth.password, function(err, success){
        if(success){
          callback(null, db);
        } else {
          if(db) db.close();
          callback(err ? err : new Error('Could not authenticate user ' + auth[0]), null);
        }
      });
    } else {
      callback(err, db);
    }
  });
}

/**
 * State of the db connection
 * @ignore
 */
Object.defineProperty(Db.prototype, "state", { enumerable: true
  , get: function () {
      return this.serverConfig._serverState;
    }
});

/**
 * @ignore
 */
var _hasWriteConcern = function(errorOptions) {
  return errorOptions == true
    || errorOptions.w > 0
    || errorOptions.w == 'majority'
    || errorOptions.j == true
    || errorOptions.journal == true
    || errorOptions.fsync == true
}

/**
 * @ignore
 */
var _setWriteConcernHash = function(options) {
  var finalOptions = {};
  if(options.w != null) finalOptions.w = options.w;  
  if(options.journal == true) finalOptions.j = options.journal;
  if(options.j == true) finalOptions.j = options.j;
  if(options.fsync == true) finalOptions.fsync = options.fsync;
  if(options.wtimeout != null) finalOptions.wtimeout = options.wtimeout;  
  return finalOptions;
}

/**
 * @ignore
 */
var _getWriteConcern = function(self, options, callback) {
  // Final options
  var finalOptions = {w:1};
  // Local options verification
  if(options.w != null || typeof options.j == 'boolean' || typeof options.journal == 'boolean' || typeof options.fsync == 'boolean') {
    finalOptions = _setWriteConcernHash(options);
  } else if(options.safe != null && typeof options.safe == 'object') {
    finalOptions = _setWriteConcernHash(options.safe);
  } else if(typeof options.safe == "boolean") {
    finalOptions = {w: (options.safe ? 1 : 0)};
  } else if(self.options.w != null || typeof self.options.j == 'boolean' || typeof self.options.journal == 'boolean' || typeof self.options.fsync == 'boolean') {
    finalOptions = _setWriteConcernHash(self.options);
  } else if(self.safe.w != null || typeof self.safe.j == 'boolean' || typeof self.safe.journal == 'boolean' || typeof self.safe.fsync == 'boolean') {
    finalOptions = _setWriteConcernHash(self.safe);
  } else if(typeof self.safe == "boolean") {
    finalOptions = {w: (self.safe ? 1 : 0)};
  }

  // Ensure we don't have an invalid combination of write concerns
  if(finalOptions.w < 1 
    && (finalOptions.journal == true || finalOptions.j == true || finalOptions.fsync == true)) throw new Error("No acknowlegement using w < 1 cannot be combined with journal:true or fsync:true");

  // Return the options
  return finalOptions;
}

/**
 * Legacy support
 *
 * @ignore
 * @api private
 */
exports.connect = Db.connect;
exports.Db = Db;

/**
 * Remove all listeners to the db instance.
 * @ignore
 * @api private
 */
Db.prototype.removeAllEventListeners = function() {
  this.removeAllListeners("close");
  this.removeAllListeners("error");
  this.removeAllListeners("timeout");
  this.removeAllListeners("parseError");
  this.removeAllListeners("poolReady");
  this.removeAllListeners("message");
}
