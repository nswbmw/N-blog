var EventEmitter = require('events').EventEmitter
  , inherits = require('util').inherits
  , mongodb_cr_authenticate = require('../auth/mongodb_cr.js').authenticate
  , mongodb_gssapi_authenticate = require('../auth/mongodb_gssapi.js').authenticate
  , mongodb_sspi_authenticate = require('../auth/mongodb_sspi.js').authenticate;  

var id = 0;

/**
 * Internal class for callback storage
 * @ignore
 */
var CallbackStore = function() {
  // Make class an event emitter
  EventEmitter.call(this);
  // Add a info about call variable
  this._notReplied = {};
  this.id = id++;
}

/**
 * @ignore
 */
inherits(CallbackStore, EventEmitter);

CallbackStore.prototype.notRepliedToIds = function() {
  return Object.keys(this._notReplied);
}

CallbackStore.prototype.callbackInfo = function(id) {
  return this._notReplied[id]; 
}

/**
 * Internal class for holding non-executed commands
 * @ignore
 */
var NonExecutedOperationStore = function(config) {  
  this.config = config;
  this.commands = {
      read: []
    , write_reads: []
    , write: []
  };
}

NonExecutedOperationStore.prototype.write = function(op) {
  this.commands.write.push(op);
}

NonExecutedOperationStore.prototype.read_from_writer = function(op) {  
  this.commands.write_reads.push(op);
}

NonExecutedOperationStore.prototype.read = function(op) {  
  this.commands.read.push(op);
}

NonExecutedOperationStore.prototype.execute_queries = function(executeInsertCommand) {
  var connection = this.config.checkoutReader();
  if(connection == null || connection instanceof Error) return;

  // Write out all the queries
  while(this.commands.read.length > 0) {
    // Get the next command
    var command = this.commands.read.shift();
    // command['options'].connection = this.config.checkoutReader();
    command.options.connection = connection;
    // Execute the next command
    command.executeQueryCommand(command.db, command.db_command, command.options, command.callback);
  }
}

NonExecutedOperationStore.prototype.execute_writes = function() {
  var connection = this.config.checkoutWriter();
  if(connection == null || connection instanceof Error) return;

  // Write out all the queries to the primary
  while(this.commands.write_reads.length > 0) {
    // Get the next command
    var command = this.commands.write_reads.shift();
    command.options.connection = connection;
    // Execute the next command
    command.executeQueryCommand(command.db, command.db_command, command.options, command.callback);
  }

  // Execute all write operations
  while(this.commands.write.length > 0) {
    // Get the next command
    var command = this.commands.write.shift();
    // Set the connection
    command.options.connection = connection;
    // Execute the next command
    command.executeInsertCommand(command.db, command.db_command, command.options, command.callback);
  }  
}

/**
 * Internal class for authentication storage
 * @ignore
 */
var AuthStore = function() {
  this._auths = [];
}

AuthStore.prototype.add = function(authMechanism, dbName, username, password, authdbName) {
  // Check for duplicates
  if(!this.contains(dbName)) {
    // Base config
    var config = {
        'username':username
      , 'password':password
      , 'db': dbName
      , 'authMechanism': authMechanism
    };

    // Add auth source if passed in
    if(typeof authdbName == 'string') {
      config['authdb'] = authdbName;
    }

    // Push the config
    this._auths.push(config);
  }
}

AuthStore.prototype.contains = function(dbName) {
  for(var i = 0; i < this._auths.length; i++) {
    if(this._auths[i].db == dbName) return true;
  }

  return false;
}

AuthStore.prototype.remove = function(dbName) {
  var newAuths = [];

  // Filter out all the login details
  for(var i = 0; i < this._auths.length; i++) {
    if(this._auths[i].db != dbName) newAuths.push(this._auths[i]);
  }

  //  Set the filtered list
  this._auths = newAuths;
}

AuthStore.prototype.get = function(index) {
  return this._auths[index];
}

AuthStore.prototype.length = function() {
  return this._auths.length;
}

AuthStore.prototype.toArray = function() {
  return this._auths.slice(0);
}

/**
 * Internal class for storing db references
 * @ignore
 */
var DbStore = function() {
  this._dbs = [];
}

DbStore.prototype.add = function(db) {
  // this._dbs.push(db);
  var found = false;
  // Only add if it does not exist already
  for(var i = 0; i < this._dbs.length; i++) {
    if(db.databaseName == this._dbs[i].databaseName) found = true;
  }

  if(!found) this._dbs.push(db);
}

DbStore.prototype.reset = function() {
  this._dbs = [];
}

DbStore.prototype.emit = function(event, message, object, reset, filterDb) {
  if(reset) {
    while(this._dbs.length > 0) {
      var db = this._dbs.shift();
      // Only emit if there is a listener
      if(db.listeners(event).length > 0) {
        if(filterDb == null  || filterDb.databaseName !== db.databaseName 
          || filterDb.tag !== db.tag) {
          db.emit(event, message, object);
        }
      }
    }
  } else {
    for(var i = 0; i < this._dbs.length; i++) {
      if(this._dbs[i].listeners(event).length > 0) {
        if(filterDb == null || filterDb.databaseName !== this._dbs[i].databaseName 
          || filterDb.tag !== this._dbs[i].tag) {
          this._dbs[i].emit(event, message, object);
        }
      }
    }
  }
}

var Base = function Base() {  
  EventEmitter.call(this);

  // Callback store is part of connection specification
  if(Base._callBackStore == null) {
    Base._callBackStore = new CallbackStore();
  }

  // Create a new callback store  
  this._callBackStore = new CallbackStore();
  // All commands not being executed
  this._commandsStore = new NonExecutedOperationStore(this);
  // Create a new auth store
  this.auth = new AuthStore();
  // Contains all the dbs attached to this server config
  this._dbStore = new DbStore();
}

/**
 * @ignore
 */
inherits(Base, EventEmitter);

/**
 * @ignore
 */
Base.prototype._apply_auths = function(db, callback) {
  _apply_auths_serially(this, db, this.auth.toArray(), callback);
}

var _apply_auths_serially = function(self, db, auths, callback) {
  if(auths.length == 0) return callback(null, null);
  // Get the first auth
  var auth = auths.shift();
  var connections = self.allRawConnections();
  var connectionsLeft = connections.length;

  // Let's apply it to all raw connections
  for(var i = 0; i < connections.length; i++) {
    if(auth.authMechanism == 'GSSAPI') {
      var options = {connection: connections[i]};

      var connectionHandler = function(err, result) {
        connectionsLeft = connectionsLeft - 1;
        // If no more connections are left return
        if(connectionsLeft == 0) {
          return _apply_auths_serially(self, db, auths, callback);
        }                
      }

      // We have the kerberos library, execute auth process
      if(process.platform == 'win32') {
        mongodb_sspi_authenticate(db, auth.username, auth.password, auth.authdb, options, callback);
      } else {
        mongodb_gssapi_authenticate(db, auth.username, auth.password, auth.authdb, options, callback);
      }
    } else if(auth.authMechanism == 'MONGODB-CR') {
      mongodb_cr_authenticate(db, auth.username, auth.password, auth.authdb, options, callback);
    }
  }
}

/**
 * Fire all the errors
 * @ignore
 */
Base.prototype.__executeAllCallbacksWithError = function(err) {
  // Check all callbacks
  var keys = Object.keys(this._callBackStore._notReplied);
  // For each key check if it's a callback that needs to be returned
  for(var j = 0; j < keys.length; j++) {
    var info = this._callBackStore._notReplied[keys[j]];
    // Check if we have a chained command (findAndModify)
    if(info && info['chained'] && Array.isArray(info['chained']) && info['chained'].length > 0) {
      var chained = info['chained'];
      // Only callback once and the last one is the right one
      var finalCallback = chained.pop();
      // Emit only the last event
      this._callBackStore.emit(finalCallback, err, null);

      // Put back the final callback to ensure we don't call all commands in the chain
      chained.push(finalCallback);

      // Remove all chained callbacks
      for(var i = 0; i < chained.length; i++) {
        delete this._callBackStore._notReplied[chained[i]];
      }
      // Remove the key
      delete this._callBackStore._notReplied[keys[j]];
    } else {
      this._callBackStore.emit(keys[j], err, null);
      // Remove the key
      delete this._callBackStore._notReplied[keys[j]];
    }
  }
}

/**
 * Fire all the errors
 * @ignore
 */
Base.prototype.__executeAllServerSpecificErrorCallbacks = function(host, port, err) {  
  // Check all callbacks
  var keys = Object.keys(this._callBackStore._notReplied);
  // For each key check if it's a callback that needs to be returned
  for(var j = 0; j < keys.length; j++) {
    var info = this._callBackStore._notReplied[keys[j]];

    if(info.connection) {
      // Unpack the connection settings
      var _host = info.connection.socketOptions.host;
      var _port = info.connection.socketOptions.port;
      // Check if we have a chained command (findAndModify)
      if(info && info['chained'] 
        && Array.isArray(info['chained']) 
        && info['chained'].length > 0
        && _port == port && _host == host) {
          var chained = info['chained'];
          // Only callback once and the last one is the right one
          var finalCallback = chained.pop();
          // Emit only the last event
          this._callBackStore.emit(finalCallback, err, null);

          // Put back the final callback to ensure we don't call all commands in the chain
          chained.push(finalCallback);

          // Remove all chained callbacks
          for(var i = 0; i < chained.length; i++) {
            delete this._callBackStore._notReplied[chained[i]];
          }
          // Remove the key
          delete this._callBackStore._notReplied[keys[j]];
      } else if(_port == port && _host == host) {
        this._callBackStore.emit(keys[j], err, null);
        // Remove the key
        delete this._callBackStore._notReplied[keys[j]];
      }      
    }
  }
}

/**
 * Register a handler
 * @ignore
 * @api private
 */
Base.prototype._registerHandler = function(db_command, raw, connection, exhaust, callback) {
  // If we have an array of commands, chain them
  var chained = Array.isArray(db_command);

  // Check if we have exhausted
  if(typeof exhaust == 'function') {
    callback = exhaust;
    exhaust = false;
  }

  // If they are chained we need to add a special handler situation
  if(chained) {
    // List off chained id's
    var chainedIds = [];
    // Add all id's
    for(var i = 0; i < db_command.length; i++) chainedIds.push(db_command[i].getRequestId().toString());
    // Register all the commands together
    for(var i = 0; i < db_command.length; i++) {
      var command = db_command[i];
      // Add the callback to the store
      this._callBackStore.once(command.getRequestId(), callback);
      // Add the information about the reply
      this._callBackStore._notReplied[command.getRequestId().toString()] = {start: new Date().getTime(), 'raw': raw, chained:chainedIds, connection:connection, exhaust:false};
    }
  } else {
    // Add the callback to the list of handlers
    this._callBackStore.once(db_command.getRequestId(), callback);
    // Add the information about the reply
    this._callBackStore._notReplied[db_command.getRequestId().toString()] = {start: new Date().getTime(), 'raw': raw, connection:connection, exhaust:exhaust};
  }
}

/**
 * Re-Register a handler, on the cursor id f.ex
 * @ignore
 * @api private
 */
Base.prototype._reRegisterHandler = function(newId, object, callback) {
  // Add the callback to the list of handlers
  this._callBackStore.once(newId, object.callback.listener);
  // Add the information about the reply
  this._callBackStore._notReplied[newId] = object.info;
}

/**
 *
 * @ignore
 * @api private
 */
Base.prototype._callHandler = function(id, document, err) {
  // If there is a callback peform it
  if(this._callBackStore.listeners(id).length >= 1) {
    // Get info object
    var info = this._callBackStore._notReplied[id];
    // Delete the current object
    delete this._callBackStore._notReplied[id];
    // Emit to the callback of the object
    this._callBackStore.emit(id, err, document, info.connection);
  }
}

/**
 *
 * @ignore
 * @api private
 */
Base.prototype._hasHandler = function(id) {
  // If there is a callback peform it
  return this._callBackStore.listeners(id).length >= 1;
}

/**
 *
 * @ignore
 * @api private
 */
Base.prototype._removeHandler = function(id) {
  // Remove the information
  if(this._callBackStore._notReplied[id] != null) delete this._callBackStore._notReplied[id];
  // Remove the callback if it's registered
  this._callBackStore.removeAllListeners(id);
  // Force cleanup _events, node.js seems to set it as a null value
  if(this._callBackStore._events != null) delete this._callBackStore._events[id];
}

/**
 *
 * @ignore
 * @api private
 */
Base.prototype._findHandler = function(id) {
  var info = this._callBackStore._notReplied[id];
  // Return the callback
  return {info:info, callback:(this._callBackStore.listeners(id).length >= 1) ? this._callBackStore.listeners(id)[0] : null}
}

/**
 *
 * @ignore
 * @api private
 */
Base.prototype._emitAcrossAllDbInstances = function(server, filterDb, event, message, object, resetConnection) {
  if(resetConnection) {
    for(var i = 0; i < this._dbStore._dbs.length; i++) {
      if(typeof this._dbStore._dbs[i].openCalled != 'undefined')
        this._dbStore._dbs[i].openCalled = false;
    }
  }
  
  // Fire event
  this._dbStore.emit(event, message, object, resetConnection, filterDb);
}

exports.Base = Base;