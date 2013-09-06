var Connection = require('./connection').Connection,  
  ReadPreference = require('./read_preference').ReadPreference,
  DbCommand = require('../commands/db_command').DbCommand,
  MongoReply = require('../responses/mongo_reply').MongoReply,
  debug = require('util').debug,
  inherits = require('util').inherits,
  inspect = require('util').inspect,
  Server = require('./server').Server,
  PingStrategy = require('./strategies/ping_strategy').PingStrategy,
  StatisticsStrategy = require('./strategies/statistics_strategy').StatisticsStrategy,
  Base = require('./base').Base;

const STATE_STARTING_PHASE_1 = 0;
const STATE_PRIMARY = 1;
const STATE_SECONDARY = 2;
const STATE_RECOVERING = 3;
const STATE_FATAL_ERROR = 4;
const STATE_STARTING_PHASE_2 = 5;
const STATE_UNKNOWN = 6;
const STATE_ARBITER = 7;
const STATE_DOWN = 8;
const STATE_ROLLBACK = 9;

/**
 * ReplSet constructor provides replicaset functionality
 *
 * Options
 *  - **ha** {Boolean, default:true}, turn on high availability.
 *  - **haInterval** {Number, default:2000}, time between each replicaset status check.
 *  - **reconnectWait** {Number, default:1000}, time to wait in miliseconds before attempting reconnect.
 *  - **retries** {Number, default:30}, number of times to attempt a replicaset reconnect.
 *  - **rs_name** {String}, the name of the replicaset to connect to.
 *  - **socketOptions** {Object, default:null}, an object containing socket options to use (noDelay:(boolean), keepAlive:(number), connectTimeoutMS:(number), socketTimeoutMS:(number))
 *  - **readPreference** {String}, the prefered read preference (ReadPreference.PRIMARY, ReadPreference.PRIMARY_PREFERRED, ReadPreference.SECONDARY, ReadPreference.SECONDARY_PREFERRED, ReadPreference.NEAREST).
 *  - **strategy** {String, default:'ping'}, selection strategy for reads choose between (ping, statistical and none, default is ping)
 *  - **secondaryAcceptableLatencyMS** {Number, default:15}, sets the range of servers to pick when using NEAREST (lowest ping ms + the latency fence, ex: range of 1 to (1 + 15) ms)
 *  - **connectArbiter** {Boolean, default:false}, sets if the driver should connect to arbiters or not.
 *  - **logger** {Object, default:null}, an object representing a logger that you want to use, needs to support functions debug, log, error **({error:function(message, object) {}, log:function(message, object) {}, debug:function(message, object) {}})**.
 *  - **ssl** {Boolean, default:false}, use ssl connection (needs to have a mongod server with ssl support)
 *  - **sslValidate** {Boolean, default:false}, validate mongod server certificate against ca (needs to have a mongod server with ssl support, 2.4 or higher)
 *  - **sslCA** {Array, default:null}, Array of valid certificates either as Buffers or Strings (needs to have a mongod server with ssl support, 2.4 or higher)
 *  - **sslCert** {Buffer/String, default:null}, String or buffer containing the certificate we wish to present (needs to have a mongod server with ssl support, 2.4 or higher)
 *  - **sslKey** {Buffer/String, default:null}, String or buffer containing the certificate private key we wish to present (needs to have a mongod server with ssl support, 2.4 or higher)
 *  - **sslPass** {Buffer/String, default:null}, String or buffer containing the certificate password (needs to have a mongod server with ssl support, 2.4 or higher)
 *
 * @class Represents a Replicaset Configuration
 * @param {Array} list of server objects participating in the replicaset.
 * @param {Object} [options] additional options for the replicaset connection.
 */
var ReplSet = exports.ReplSet = function(servers, options) {
  this.count = 0;

  // Set up basic
  if(!(this instanceof ReplSet))
    return new ReplSet(servers, options);

  // Set up event emitter
  Base.call(this);

  // Ensure no Mongos's
  for(var i = 0; i < servers.length; i++) {
    if(!(servers[i] instanceof Server)) throw new Error("list of servers must be of type Server");
  }

  // Just reference for simplicity
  var self = this;
  // Contains the master server entry
  this.options = options == null ? {} : options;
  this.reconnectWait = this.options["reconnectWait"] != null ? this.options["reconnectWait"] : 1000;
  this.retries = this.options["retries"] != null ? this.options["retries"] : 30;
  this.replicaSet = this.options["rs_name"];

  // Are we allowing reads from secondaries ?
  this.readSecondary = this.options["read_secondary"];
  this.slaveOk = true;
  this.closedConnectionCount = 0;
  this._used = false;

  // Connect arbiters ?
  this.connectArbiter = this.options.connectArbiter == null ? false : this.options.connectArbiter;

  // Default poolSize for new server instances
  this.poolSize = this.options.poolSize == null ? 5 : this.options.poolSize;
  this._currentServerChoice = 0;

  // Set up ssl connections
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

  // Internal state of server connection
  this._serverState = 'disconnected';
  // Read preference
  this._readPreference = null;
  // HA running
  this._haRunning = false;
  // Do we record server stats or not
  this.recordQueryStats = false;
  // Update health try server
  this.updateHealthServerTry = 0;

  // Get the readPreference
  var readPreference = this.options['readPreference'];

  // Validate correctness of Read preferences
  if(readPreference != null) {
    if(readPreference != ReadPreference.PRIMARY && readPreference != ReadPreference.PRIMARY_PREFERRED
      && readPreference != ReadPreference.SECONDARY && readPreference != ReadPreference.SECONDARY_PREFERRED
      && readPreference != ReadPreference.NEAREST && typeof readPreference != 'object' && readPreference['_type'] != 'ReadPreference') {
      throw new Error("Illegal readPreference mode specified, " + readPreference);
    }

    this._readPreference = readPreference;
  } else {
    this._readPreference = null;
  }

  // Ensure read_secondary is set correctly
  if(!this.readSecondary)
    this.readSecondary = this._readPreference == ReadPreference.PRIMARY 
        || this._readPreference == false  
        || this._readPreference == null ? false : true;

  // Ensure correct slave set
  if(this.readSecondary) this.slaveOk = true;

  // Strategy for picking a secondary
  this.secondaryAcceptableLatencyMS = this.options['secondaryAcceptableLatencyMS'] == null ? 15 : this.options['secondaryAcceptableLatencyMS'];
  this.strategy = this.options['strategy'];
  // Make sure strategy is one of the two allowed
  if(this.strategy != null && (this.strategy != 'ping' && this.strategy != 'statistical' && this.strategy != 'none')) 
      throw new Error("Only ping or statistical strategies allowed");    
  if(this.strategy == null) this.strategy = 'ping';
  // Let's set up our strategy object for picking secodaries
  if(this.strategy == 'ping') {
    // Create a new instance
    this.strategyInstance = new PingStrategy(this, this.secondaryAcceptableLatencyMS);
  } else if(this.strategy == 'statistical') {
    // Set strategy as statistical
    this.strategyInstance = new StatisticsStrategy(this);
    // Add enable query information
    this.enableRecordQueryStats(true);
  }

  // Set logger if strategy exists
  if(this.strategyInstance) this.strategyInstance.logger = this.logger;

  // Set default connection pool options
  this.socketOptions = this.options.socketOptions != null ? this.options.socketOptions : {};

  // Set up logger if any set
  this.logger = this.options.logger != null
    && (typeof this.options.logger.debug == 'function')
    && (typeof this.options.logger.error == 'function')
    && (typeof this.options.logger.debug == 'function')
      ? this.options.logger : {error:function(message, object) {}, log:function(message, object) {}, debug:function(message, object) {}};

  // Ensure all the instances are of type server and auto_reconnect is false
  if(!Array.isArray(servers) || servers.length == 0) {
    throw Error("The parameter must be an array of servers and contain at least one server");
  } else if(Array.isArray(servers) || servers.length > 0) {
    var count = 0;
    servers.forEach(function(server) {
      if(server instanceof Server) count = count + 1;
      // Ensure no server has reconnect on
      server.options.auto_reconnect = false;
      // Set up ssl options
      server.ssl = self.ssl;
      server.sslValidate = self.sslValidate;
      server.sslCA = self.sslCA;
      server.sslCert = self.sslCert;
      server.sslKey = self.sslKey;
      server.sslPass = self.sslPass;
      server.poolSize = self.poolSize;
      // Set callback store
      server._callBackStore = self._callBackStore;
    });

    if(count < servers.length) {
      throw Error("All server entries must be of type Server");
    } else {
      this.servers = servers;
    }
  }

  // var deduplicate list
  var uniqueServers = {};
  // De-duplicate any servers in the seed list
  for(var i = 0; i < this.servers.length; i++) {
    var server = this.servers[i];
    // If server does not exist set it
    if(uniqueServers[server.host + ":" + server.port] == null) {
      uniqueServers[server.host + ":" + server.port] = server;
    }
  }

  // Let's set the deduplicated list of servers
  this.servers = [];
  // Add the servers
  for(var key in uniqueServers) {
    this.servers.push(uniqueServers[key]);
  }

  // Enabled ha
  this.haEnabled = this.options['ha'] == null ? true : this.options['ha'];
  this._haServer = null;
  // How often are we checking for new servers in the replicaset
  this.replicasetStatusCheckInterval = this.options['haInterval'] == null ? 5000 : this.options['haInterval'];

  // Connection timeout
  this._connectTimeoutMS = this.socketOptions.connectTimeoutMS
    ? this.socketOptions.connectTimeoutMS
    : 1000;
  // Socket connection timeout
  this._socketTimeoutMS = this.socketOptions.socketTimeoutMS
    ? this.socketOptions.socketTimeoutMS
    : (this.replicasetStatusCheckInterval + 1000);
};

/**
 * @ignore
 */
inherits(ReplSet, Base);

/**
 * @ignore
 */
// Allow setting the read preference at the replicaset level
ReplSet.prototype.setReadPreference = function(preference) {
  // Set read preference
  this._readPreference = preference;
  // Ensure slaveOk is correct for secondaries read preference and tags
  if((this._readPreference == ReadPreference.SECONDARY_PREFERRED 
    || this._readPreference == ReadPreference.SECONDARY
    || this._readPreference == ReadPreference.NEAREST)
    || (this._readPreference != null && typeof this._readPreference == 'object')) {
    this.slaveOk = true;
  }
}

/**
 * @ignore
 */
ReplSet.prototype._isUsed = function() {
  return this._used;
}

/**
 * @ignore
 */
ReplSet.prototype.isMongos = function() {
  return false;
}

/**
 * @ignore
 */
ReplSet.prototype.isConnected = function(read) {
  if(read == null || read == ReadPreference.PRIMARY || read == false)
    return this.primary != null && this._state.master != null && this._state.master.isConnected();

  if((read == ReadPreference.PRIMARY_PREFERRED || read == ReadPreference.SECONDARY_PREFERRED || read == ReadPreference.NEAREST)
    && ((this.primary != null && this._state.master != null && this._state.master.isConnected())
    || (this._state && this._state.secondaries && Object.keys(this._state.secondaries).length > 0))) {
      return true;
  } else if(read == ReadPreference.SECONDARY) {
    return this._state && this._state.secondaries && Object.keys(this._state.secondaries).length > 0;
  }

  // No valid connection return false
  return false;
}

/**
 * @ignore
 */
ReplSet.prototype.isSetMember = function() {
  return false;
}

/**
 * @ignore
 */
ReplSet.prototype.isPrimary = function(config) {
  return this.readSecondary && Object.keys(this._state.secondaries).length > 0 ? false : true;
}

/**
 * @ignore
 */
ReplSet.prototype.isReadPrimary = ReplSet.prototype.isPrimary;

/**
 * @ignore
 */
ReplSet.prototype.allServerInstances = function() {
  var self = this;
  // If no state yet return empty
  if(!self._state) return [];
  // Close all the servers (concatenate entire list of servers first for ease)
  var allServers = self._state.master != null ? [self._state.master] : [];

  // Secondary keys
  var keys = Object.keys(self._state.secondaries);
  // Add all secondaries
  for(var i = 0; i < keys.length; i++) {
    allServers.push(self._state.secondaries[keys[i]]);
  }

  // Arbiter keys
  var keys = Object.keys(self._state.arbiters);
  // Add all arbiters
  for(var i = 0; i < keys.length; i++) {
    allServers.push(self._state.arbiters[keys[i]]);
  }

  // Passive keys
  var keys = Object.keys(self._state.passives);
  // Add all arbiters
  for(var i = 0; i < keys.length; i++) {
    allServers.push(self._state.passives[keys[i]]);
  }

  // Return complete list of all servers
  return allServers;
}

/**
 * Enables high availability pings.
 *
 * @ignore
 */
ReplSet.prototype._enableHA = function () {
  var self = this;
  self._haRunning = true;
  return check();

  function ping () {
    // We are disconnected stop pinging and close current connection if any
    if("disconnected" == self._serverState) {
      if(self._haServer != null) self._haServer.close();
      return;
    }

    // Create a list of all servers we can send the ismaster command to
    var allServers = self._state.master != null ? [self._state.master] : [];

    // Secondary keys
    var keys = Object.keys(self._state.secondaries);
    // Add all secondaries
    for(var i = 0; i < keys.length; i++) {
      allServers.push(self._state.secondaries[keys[i]]);
    }

    // If no servers quit as are probably connecting
    if(allServers.length == 0) return;
    // Pick one of the servers 
    self.updateHealthServerTry = self.updateHealthServerTry++ % allServers.length;
    var selectedServer = allServers[self.updateHealthServerTry];

    // If we have an active db instance
    if(self.dbInstances.length > 0) {
      var db = self.dbInstances[0];

      // We have an instance already
      if(self._haServer == null) {
        // Create a new master connection
        self._haServer = new Server(selectedServer.host, selectedServer.port, {
          auto_reconnect: false,
          returnIsMasterResults: true,
          slaveOk: true,
          poolSize: 1,
          socketOptions: { 
            connectTimeoutMS: self._connectTimeoutMS,
            socketTimeoutMS: self._socketTimeoutMS
          },
          ssl: self.ssl,
          sslValidate: self.sslValidate,
          sslCA: self.sslCA,
          sslCert: self.sslCert,
          sslKey: self.sslKey,
          sslPass: self.sslPass
        });

        self._haServer._callBackStore = self._callBackStore;

        // Add error handlers
        self._haServer.on("close", function() {
          if(self._haServer) self._haServer.close();
          self._haServer = null;
        });  

        self._haServer.on("error", function() {
          if(self._haServer) self._haServer.close();
          self._haServer = null;          
        });

        self._haServer.on("timeout", function() {
          if(self._haServer) self._haServer.close();
          self._haServer = null;          
        });

        // Connect using the new _server connection to not impact the driver
        // behavior on any errors we could possibly run into
        self._haServer.connect(db, function(err, result, _server) {
          if("disconnected" == self._serverState) {
            if(_server && _server.close) _server.close();            
            self._haRunning = false;
            return;
          }
            
          if(err) {
            if(_server && _server.close) _server.close();
            return check();
          }

          executeMasterCommand(db, _server);
        });              
      } else {
        executeMasterCommand(db, self._haServer);
      }
    }
  }

  function executeMasterCommand(db, _server) {
    try {
      // Create is master command
      var cmd = DbCommand.createIsMasterCommand(db);
      // Execute is master command
      db._executeQueryCommand(cmd, {failFast:true, connection: _server.checkoutReader()}, function(err, res) {
        if("disconnected" == self._serverState) {
          if(_server && _server.close) _server.close();            
          self._haRunning = false;
          self._haServer = null;
          return;
        }
        // If error let's set perform another check
        if(err) {
          // Force new server selection
          self._haServer = null;
          return check();
        }
        // Validate the replicaset            
        self._validateReplicaset(res, db.auths, function() {
          check();
        });              
      });          
    } catch(err) {
      if(self._haServer) self._haServer.close();
      self._haServer = null;
      check();
    }    
  }

  function check() {
    self._haTimer = setTimeout(ping, self.replicasetStatusCheckInterval);
  }
}

/**
 * @ignore
 */
ReplSet.prototype._validateReplicaset = function(result, auths, cb) {
  var self = this;
  var res = result.documents[0];

  // manage master node changes
  if(res.primary && self._state.master && self._state.master.name != res.primary) {
    // Delete master record so we can rediscover it
    delete self._state.addresses[self._state.master.name];

    // TODO existing issue? this seems to only work if
    // we already have a connection to the new primary.

    // Update information on new primary
    // add as master, remove from secondary
    var newMaster = self._state.addresses[res.primary];
    newMaster.isMasterDoc.ismaster = true;
    newMaster.isMasterDoc.secondary = false;
    self._state.master = newMaster;
    delete self._state.secondaries[res.primary];
  }

  // discover new hosts
  var hosts = [];

  for(var i = 0; i < res.hosts.length; ++i) {
    var host = res.hosts[i];
    if (host == res.me) continue;
    if (!(self._state.addresses[host] || ~hosts.indexOf(host))) {
      // we dont already have a connection to this host and aren't
      // already planning on connecting.
      hosts.push(host);
    }
  }

  connectTo(hosts, auths, self, cb);
}

/**
 * Create connections to all `hosts` firing `cb` after
 * connections are attempted for all `hosts`.
 *
 * @param {Array} hosts
 * @param {Array} [auths]
 * @param {ReplSet} replset
 * @param {Function} cb
 * @ignore
 */
function connectTo(hosts, auths, replset, cb) {
  var pending = hosts.length;
  if (!pending) return cb();

  for(var i = 0; i < hosts.length; ++i) {
    connectToHost(hosts[i], auths, replset, handle);
  }

  function handle () {
    --pending;
    if (0 === pending) cb();
  }
}

/**
 * Attempts connection to `host` and authenticates with optional `auth`
 * for the given `replset` firing `cb` when finished.
 *
 * @param {String} host
 * @param {Array} auths
 * @param {ReplSet} replset
 * @param {Function} cb
 * @ignore
 */
function connectToHost(host, auths, replset, cb) {
  var server = createServer(host, replset);

  var options = {
    returnIsMasterResults: true,
    eventReceiver: server
  }

  server.connect(replset.db, options, function(err, result) {
    var doc = result && result.documents && result.documents[0];

    if (err || !doc) {
      server.close();
      return cb(err, result, server);
    }

    if(!(doc.ismaster || doc.secondary || doc.arbiterOnly)) {
      server.close();
      return cb(null, result, server);
    }

    // if host is an arbiter, disconnect if not configured for it
    if(doc.arbiterOnly && !replset.connectArbiter) {
      server.close();
      return cb(null, result, server);
    }

    // create handler for successful connections
    var handleConnect = _connectHandler(replset, null, server);
    function complete () {
      handleConnect(err, result);
      cb();
    }

    // authenticate if necessary
    if(!(Array.isArray(auths) && auths.length > 0)) {
      return complete();
    }

    var pending = auths.length;

    var connections = server.allRawConnections();
    var pendingAuthConn = connections.length;
    for(var x = 0; x <connections.length; x++) {
      var connection = connections[x];
      var authDone = false; 
      for(var i = 0; i < auths.length; i++) {
        var auth = auths[i];
        var options = { authdb: auth.authdb, connection: connection };
        var username = auth.username;
        var password = auth.password;
        replset.db.authenticate(username, password, options, function() {
          --pending;
          if(0 === pending) {
            authDone = true;
            --pendingAuthConn;
            if(0 === pendingAuthConn) {
              return complete();
            }  
          }
        });
      }
    }
  });
}

/**
 * Creates a new server for the `replset` based on `host`.
 *
 * @param {String} host - host:port pair (localhost:27017)
 * @param {ReplSet} replset - the ReplSet instance
 * @return {Server}
 * @ignore
 */
function createServer(host, replset) {
  // copy existing socket options to new server
  var socketOptions = {}
  if(replset.socketOptions) {
    var keys = Object.keys(replset.socketOptions);
    for(var k = 0; k < keys.length; k++) {
      socketOptions[keys[k]] = replset.socketOptions[keys[k]];
    }
  }

  var parts = host.split(/:/);
  if(1 === parts.length) {
    parts[1] = Connection.DEFAULT_PORT;
  }

  socketOptions.host = parts[0];
  socketOptions.port = parseInt(parts[1], 10);

  var serverOptions = {
    readPreference: replset._readPreference,
    socketOptions: socketOptions,
    poolSize: replset.poolSize,
    logger: replset.logger,
    auto_reconnect: false,
    ssl: replset.ssl,
    sslValidate: replset.sslValidate,
    sslCA: replset.sslCA,
    sslCert: replset.sslCert,
    sslKey: replset.sslKey,
    sslPass: replset.sslPass
  }

  var server = new Server(socketOptions.host, socketOptions.port, serverOptions);
  server._callBackStore = replset._callBackStore;
  server.replicasetInstance = replset;
  server.on("close", _handler("close", replset));
  server.on("error", _handler("error", replset));
  server.on("timeout", _handler("timeout", replset));
  return server;
}

var _handler = function(event, self) {
  return function(err, server) {   
    // Remove from all lists
    delete self._state.secondaries[server.name];
    delete self._state.arbiters[server.name];
    delete self._state.passives[server.name];
    delete self._state.addresses[server.name];

    // Execute all the callbacks with errors
    self.__executeAllCallbacksWithError(err);

    // If we have app listeners on close event
    if(self.db.listeners(event).length > 0) {
      self.db.emit(event, err);
    }

    // If it's the primary close all connections
    if(self._state.master 
      && self._state.master.host == server.host
      && self._state.master.port == server.port) {
      // return self.close();
      self._state.master = null;
    }
  }
}

var _connectHandler = function(self, candidateServers, instanceServer) {
  return function(err, result) {
    // If we have an ssl error store the error
    if(err && err.ssl) {
      self._sslError = err;
    }

    // We are disconnected stop attempting reconnect or connect
    if(self._serverState == 'disconnected') return instanceServer.close();

    // If no error handle isMaster
    if(err == null && result.documents[0].hosts != null) {
      // Fetch the isMaster command result
      var document = result.documents[0];
      // Break out the results
      var setName = document.setName;
      var isMaster = document.ismaster;
      var secondary = document.secondary;
      var passive = document.passive;
      var arbiterOnly = document.arbiterOnly;
      var hosts = Array.isArray(document.hosts) ? document.hosts : [];
      var arbiters = Array.isArray(document.arbiters) ? document.arbiters : [];
      var passives = Array.isArray(document.passives) ? document.passives : [];
      var tags = document.tags ? document.tags : {};
      var primary = document.primary;
      // Find the current server name and fallback if none
      var userProvidedServerString = instanceServer.host + ":" + instanceServer.port;
      var me = document.me || userProvidedServerString;

      // Verify if the set name is the same otherwise shut down and return an error
      if(self.replicaSet == null) {
        self.replicaSet = setName;
      } else if(self.replicaSet != setName) {
        // Stop the set
        self.close();
        // Emit a connection error
        return self.emit("connectionError",
          new Error("configured mongodb replicaset does not match provided replicaset [" + setName + "] != [" + self.replicaSet + "]"))
      }

      // Make sure we have the right reference
      var oldServer = self._state.addresses[userProvidedServerString]
      if (oldServer && oldServer !== instanceServer) oldServer.close();
      delete self._state.addresses[userProvidedServerString];

      if (self._state.addresses[me] && self._state.addresses[me] !== instanceServer) {
        self._state.addresses[me].close();
      }

      self._state.addresses[me] = instanceServer;

      // Let's add the server to our list of server types
      if(secondary == true && (passive == false || passive == null)) {
        self._state.secondaries[me] = instanceServer;
      } else if(arbiterOnly == true) {
        self._state.arbiters[me] = instanceServer;
      } else if(secondary == true && passive == true) {
        self._state.passives[me] = instanceServer;
      } else if(isMaster == true) {
        self._state.master = instanceServer;
      } else if(isMaster == false && primary != null && self._state.addresses[primary]) {
        self._state.master = self._state.addresses[primary];
      }

      // Set the name
      instanceServer.name = me;
      // Add tag info
      instanceServer.tags = tags;

      // Add the handlers to the instance
      instanceServer.on("close", _handler("close", self));
      instanceServer.on("error", _handler("error", self));
      instanceServer.on("timeout", _handler("timeout", self));

      // Possible hosts
      var possibleHosts = Array.isArray(hosts) ? hosts.slice() : [];
      possibleHosts = Array.isArray(passives) ? possibleHosts.concat(passives) : possibleHosts;

      if(self.connectArbiter == true) {
        possibleHosts = Array.isArray(arbiters) ? possibleHosts.concat(arbiters) : possibleHosts;
      }

      if(Array.isArray(candidateServers)) {
        // Add any new candidate servers for connection
        for(var j = 0; j < possibleHosts.length; j++) {
          if(self._state.addresses[possibleHosts[j]] == null && possibleHosts[j] != null) {
            var parts = possibleHosts[j].split(/:/);
            if(parts.length == 1) {
              parts = [parts[0], Connection.DEFAULT_PORT];
            }

            // New candidate server
            var candidateServer = new Server(parts[0], parseInt(parts[1]));
            candidateServer._callBackStore = self._callBackStore;
            candidateServer.name = possibleHosts[j];
            candidateServer.ssl = self.ssl;
            candidateServer.sslValidate = self.sslValidate;
            candidateServer.sslCA = self.sslCA;
            candidateServer.sslCert = self.sslCert;
            candidateServer.sslKey = self.sslKey;
            candidateServer.sslPass = self.sslPass;

            // Set the candidate server
            self._state.addresses[possibleHosts[j]] = candidateServer;
            // Add the new server to the list of candidate servers
            candidateServers.push(candidateServer);
          }
        }
      }
    } else if(err != null || self._serverState == 'disconnected'){
      delete self._state.addresses[instanceServer.host + ":" + instanceServer.port];
      // Remove it from the set
      instanceServer.close();
    }

    // Attempt to connect to the next server
    if(Array.isArray(candidateServers) && candidateServers.length > 0) {
      var server = candidateServers.pop();

      // Get server addresses
      var addresses = self._state.addresses;

      // Default empty socket options object
      var socketOptions = {};

      // Set fast connect timeout
      socketOptions['connectTimeoutMS'] = self._connectTimeoutMS;

      // If a socket option object exists clone it
      if(self.socketOptions != null && typeof self.socketOptions === 'object') {
        var keys = Object.keys(self.socketOptions);
        for(var j = 0; j < keys.length;j++) socketOptions[keys[j]] = self.socketOptions[keys[j]];
      }

      // If ssl is specified
      if(self.ssl) server.ssl = true;

      // Add host information to socket options
      socketOptions['host'] = server.host;
      socketOptions['port'] = server.port;
      server.socketOptions = socketOptions;
      server.replicasetInstance = self;
      server.enableRecordQueryStats(self.recordQueryStats);

      // Set the server
      if (addresses[server.host + ":" + server.port] != server) {
        if (addresses[server.host + ":" + server.port]) {
          // Close the connection before deleting
          addresses[server.host + ":" + server.port].close();
        }
        delete addresses[server.host + ":" + server.port];
      }

      addresses[server.host + ":" + server.port] = server;
      // Connect
      server.connect(self.db, {returnIsMasterResults: true, eventReceiver:server}, _connectHandler(self, candidateServers, server));
    } else if(Array.isArray(candidateServers)) {
      // If we have no primary emit error
      if(self._state.master == null) {
        // Stop the set
        self.close();

        // If we have an ssl error send the message instead of no primary found
        if(self._sslError) {
          return self.emit("connectionError", self._sslError);
        }

        // Emit a connection error
        return self.emit("connectionError",
          new Error("no primary server found in set"))
      } else{
        if(self.strategyInstance) {
          self.strategyInstance.start();
        }

        for(var i = 0; i < self.dbInstances.length; i++) self.dbInstances[i]._state = 'connected';
        self.emit("fullsetup", null, self.db, self);
        self.emit("open", null, self.db, self);          
      }
    }
  }
}

var _fullsetup_emitted = false;

/**
 * Interval state object constructor
 *
 * @ignore
 */
ReplSet.State = function ReplSetState () {
  this.errorMessages = [];
  this.secondaries = {};
  this.addresses = {};
  this.arbiters = {};
  this.passives = {};
  this.members = [];
  this.errors = {};
  this.setName = null;
  this.master = null;
}

/**
 * @ignore
 */
ReplSet.prototype.connect = function(parent, options, callback) {
  var self = this;
  if('function' === typeof options) callback = options, options = {};
  if(options == null) options = {};
  if(!('function' === typeof callback)) callback = null;

  // Ensure it's all closed
  self.close();

  // Set connecting status
  this.db = parent;
  this._serverState = 'connecting';
  this._callbackList = [];

  this._state = new ReplSet.State();

  // Ensure parent can do a slave query if it's set
  parent.slaveOk = this.slaveOk
    ? this.slaveOk
    : parent.slaveOk;

  // Remove any listeners
  this.removeAllListeners("fullsetup");
  this.removeAllListeners("connectionError");

  // Add primary found event handler
  this.once("fullsetup", function() {
    self._handleOnFullSetup(parent);

    // Callback
    if(typeof callback == 'function') {
      var internalCallback = callback;
      callback = null;
      internalCallback(null, parent, self);
    }
  });

  this.once("connectionError", function(err) {
    self._serverState = 'disconnected';
    // Ensure it's all closed
    self.close();
    // Perform the callback
    if(typeof callback == 'function') {
      var internalCallback = callback;
      callback = null;
      internalCallback(err, parent, self);
    }
  });

  // Get server addresses
  var addresses = this._state.addresses;

  // De-duplicate any servers
  var server, key;
  for(var i = 0; i < this.servers.length; i++) {
    server = this.servers[i];
    key = server.host + ":" + server.port;
    if(null == addresses[key]) {
      addresses[key] = server;
    }
  }

  // Get the list of servers that is deduplicated and start connecting
  var candidateServers = [];
  var keys = Object.keys(addresses);
  for(var i = 0; i < keys.length; i++) {
    server = addresses[keys[i]];
    server.assignReplicaSet(this);
    candidateServers.push(server);
  }

  // Let's connect to the first one on the list
  server = candidateServers.pop();
  var opts = {
    returnIsMasterResults: true,
    eventReceiver: server
  }

  server.connect(parent, opts, _connectHandler(self, candidateServers, server));    
}

/**
 * Handles the first `fullsetup` event of this ReplSet.
 *
 * @param {Db} parent
 * @ignore
 */
ReplSet.prototype._handleOnFullSetup = function (parent) {
  this._serverState = 'connected';
  for(var i = 0; i < this.dbInstances.length; i++) this.dbInstances[i]._state = 'connected';
  if(parent._state) parent._state = 'connected';
  // Emit the fullsetup and open event
  parent.emit("open", null, this.db, this);
  parent.emit("fullsetup", null, this.db, this);

  if(!this.haEnabled) return;
  if(this._haRunning) return;
  this._enableHA();
}

/**
 * Disables high availability pings.
 *
 * @ignore
 */
ReplSet.prototype._disableHA = function () {
  clearTimeout(this._haTimer);
  this._haTimer = undefined;
}

/**
 * @ignore
 */
ReplSet.prototype.checkoutWriter = function() {
  // Establish connection
  var connection = this._state.master != null ? this._state.master.checkoutWriter() : null;
  // Return the connection
  return connection;
}

/**
 * @ignore
 */
var pickFirstConnectedSecondary = function pickFirstConnectedSecondary(self, tags) {
  var keys = Object.keys(self._state.secondaries);
  var connection;

  // Find first available reader if any
  for(var i = 0; i < keys.length; i++) {
    connection = self._state.secondaries[keys[i]].checkoutReader();
    if(connection) return connection;
  }

  // If we still have a null, read from primary if it's not secondary only
  if(self._readPreference == ReadPreference.SECONDARY_PREFERRED) {
    connection = self._state.master.checkoutReader();
    if(connection) return connection;
  }

  var preferenceName = self._readPreference == ReadPreference.SECONDARY_PREFERRED
    ? 'secondary'
    : self._readPreference;

  return new Error("No replica set member available for query with ReadPreference "
                  + preferenceName + " and tags " + JSON.stringify(tags));
}

/**
 * @ignore
 */
var _pickFromTags = function(self, tags) {
  // If we have an array or single tag selection
  var tagObjects = Array.isArray(tags) ? tags : [tags];
  // Iterate over all tags until we find a candidate server
  for(var _i = 0; _i < tagObjects.length; _i++) {
    // Grab a tag object
    var tagObject = tagObjects[_i];
    // Matching keys
    var matchingKeys = Object.keys(tagObject);
    // Match all the servers that match the provdided tags
    var keys = Object.keys(self._state.secondaries);
    var candidateServers = [];

    for(var i = 0; i < keys.length; i++) {
      var server = self._state.secondaries[keys[i]];
      // If we have tags match
      if(server.tags != null) {
        var matching = true;
        // Ensure we have all the values
        for(var j = 0; j < matchingKeys.length; j++) {
          if(server.tags[matchingKeys[j]] != tagObject[matchingKeys[j]]) {
            matching = false;
            break;
          }
        }

        // If we have a match add it to the list of matching servers
        if(matching) {
          candidateServers.push(server);
        }
      }
    }

    // If we have a candidate server return
    if(candidateServers.length > 0) {
      if(this.strategyInstance) return this.strategyInstance.checkoutConnection(tags, candidateServers);
      // Set instance to return
      return candidateServers[Math.floor(Math.random() * candidateServers.length)].checkoutReader();
    }
  }

  // No connection found
  return null;
}

/**
 * @ignore
 */
ReplSet.prototype.checkoutReader = function(readPreference, tags) {
  var connection = null;

  // If we have a read preference object unpack it
  if(typeof readPreference == 'object' && readPreference['_type'] == 'ReadPreference') {
    // Validate if the object is using a valid mode
    if(!readPreference.isValid()) throw new Error("Illegal readPreference mode specified, " + readPreference.mode);
    // Set the tag
    tags = readPreference.tags;
    readPreference = readPreference.mode;
  } else if(typeof readPreference == 'object' && readPreference['_type'] != 'ReadPreference') {
    throw new Error("read preferences must be either a string or an instance of ReadPreference");
  }

  // Set up our read Preference, allowing us to override the readPreference
  var finalReadPreference = readPreference != null ? readPreference : this._readPreference;
  finalReadPreference = finalReadPreference == true ? ReadPreference.SECONDARY_PREFERRED : finalReadPreference;
  finalReadPreference = finalReadPreference == null ? ReadPreference.PRIMARY : finalReadPreference;

  // If we are reading from a primary
  if(finalReadPreference == 'primary') {
    // If we provide a tags set send an error
    if(typeof tags == 'object' && tags != null) {
      return new Error("PRIMARY cannot be combined with tags");
    }

    // If we provide a tags set send an error
    if(this._state.master == null) {
      return new Error("No replica set primary available for query with ReadPreference PRIMARY");
    }

    // Checkout a writer
    return this.checkoutWriter();
  }

  // If we have specified to read from a secondary server grab a random one and read
  // from it, otherwise just pass the primary connection
  if((this.readSecondary || finalReadPreference == ReadPreference.SECONDARY_PREFERRED || finalReadPreference == ReadPreference.SECONDARY) && Object.keys(this._state.secondaries).length > 0) {
    // If we have tags, look for servers matching the specific tag
    if(this.strategyInstance != null) {
      // Only pick from secondaries
      var _secondaries = [];
      for(var key in this._state.secondaries) {
        _secondaries.push(this._state.secondaries[key]);
      }

      if(finalReadPreference == ReadPreference.SECONDARY) {
        // Check out the nearest from only the secondaries
        connection = this.strategyInstance.checkoutConnection(tags, _secondaries);
      } else {
        connection = this.strategyInstance.checkoutConnection(tags, _secondaries);
        // No candidate servers that match the tags, error
        if(connection == null || connection instanceof Error) {
          // No secondary server avilable, attemp to checkout a primary server
          connection = this.checkoutWriter();
          // If no connection return an error
          if(connection == null) {
            return new Error("No replica set members available for query");
          }
        }
      }
    } else if(tags != null && typeof tags == 'object') {
      // Get connection
      connection = _pickFromTags(this, tags);// = function(self, readPreference, tags) {
      // No candidate servers that match the tags, error
      if(connection == null) {
        return new Error("No replica set members available for query");
      }
    } else {
      connection = _roundRobin(this, tags);
    }
  } else if(finalReadPreference == ReadPreference.PRIMARY_PREFERRED) {
    // Check if there is a primary available and return that if possible
    connection = this.checkoutWriter();
    // If no connection available checkout a secondary
    if(connection == null) {
      // If we have tags, look for servers matching the specific tag
      if(tags != null && typeof tags == 'object') {
        // Get connection
        connection = _pickFromTags(this, tags);// = function(self, readPreference, tags) {
        // No candidate servers that match the tags, error
        if(connection == null) {
          return new Error("No replica set members available for query");
        }
      } else {
        connection = _roundRobin(this, tags);
      }
    }
  } else if(finalReadPreference == ReadPreference.SECONDARY_PREFERRED) {
    // If we have tags, look for servers matching the specific tag
    if(this.strategyInstance != null) {
      connection = this.strategyInstance.checkoutConnection(tags);
      // No candidate servers that match the tags, error
      if(connection == null || connection instanceof Error) {
        // No secondary server avilable, attemp to checkout a primary server
        connection = this.checkoutWriter();
        // If no connection return an error
        if(connection == null) {
          var preferenceName = finalReadPreference == ReadPreference.SECONDARY ? 'secondary' : finalReadPreference;
          connection = new Error("No replica set member available for query with ReadPreference " + preferenceName + " and tags " + JSON.stringify(tags));
          // return new Error("No replica set members available for query");
        }
      }
    } else if(tags != null && typeof tags == 'object') {
      // Get connection
      connection = _pickFromTags(this, tags);// = function(self, readPreference, tags) {
      // No candidate servers that match the tags, error
      if(connection == null) {
        // No secondary server avilable, attemp to checkout a primary server
        connection = this.checkoutWriter();
        // If no connection return an error
        if(connection == null) {
          var preferenceName = finalReadPreference == ReadPreference.SECONDARY ? 'secondary' : finalReadPreference;
          connection = new Error("No replica set member available for query with ReadPreference " + preferenceName + " and tags " + JSON.stringify(tags));
          // return new Error("No replica set members available for query");
        }
      }
    }
  } else if(finalReadPreference == ReadPreference.NEAREST && this.strategyInstance != null) {
    connection = this.strategyInstance.checkoutConnection(tags);
  } else if(finalReadPreference == ReadPreference.NEAREST && this.strategyInstance == null) {
    return new Error("A strategy for calculating nearness must be enabled such as ping or statistical");
  } else if(finalReadPreference == ReadPreference.SECONDARY && Object.keys(this._state.secondaries).length == 0) {
    if(tags != null && typeof tags == 'object') {
      var preferenceName = finalReadPreference == ReadPreference.SECONDARY ? 'secondary' : finalReadPreference;
      connection = new Error("No replica set member available for query with ReadPreference " + preferenceName + " and tags " + JSON.stringify(tags));
    } else {
      connection = new Error("No replica set secondary available for query with ReadPreference SECONDARY");
    }
  } else {
    connection = this.checkoutWriter();
  }

  // Return the connection
  return connection;
}

/**
 * Pick a secondary using round robin
 *
 * @ignore
 */
function _roundRobin (replset, tags) {
  var keys = Object.keys(replset._state.secondaries);
  var key = keys[replset._currentServerChoice++ % keys.length];

  var conn = null != replset._state.secondaries[key]
    ? replset._state.secondaries[key].checkoutReader()
    : null;

  // If connection is null fallback to first available secondary
  if (null == conn) {
    conn = pickFirstConnectedSecondary(replset, tags);
  }

  return conn;
}

/**
 * @ignore
 */
ReplSet.prototype.allRawConnections = function() {
  // Neeed to build a complete list of all raw connections, start with master server
  var allConnections = [];
  if(this._state.master == null) return [];
  // Get connection object
  var allMasterConnections = this._state.master.connectionPool.getAllConnections();
  // Add all connections to list
  allConnections = allConnections.concat(allMasterConnections);
  // If we have read secondary let's add all secondary servers
  if(Object.keys(this._state.secondaries).length > 0) {
    // Get all the keys
    var keys = Object.keys(this._state.secondaries);
    // For each of the secondaries grab the connections
    for(var i = 0; i < keys.length; i++) {
      // Get connection object
      var secondaryPoolConnections = this._state.secondaries[keys[i]].connectionPool.getAllConnections();
      // Add all connections to list
      allConnections = allConnections.concat(secondaryPoolConnections);
    }
  }

  // Return all the conections
  return allConnections;
}

/**
 * @ignore
 */
ReplSet.prototype.enableRecordQueryStats = function(enable) {
  // Set the global enable record query stats
  this.recordQueryStats = enable;
  // Ensure all existing servers already have the flag set, even if the
  // connections are up already or we have not connected yet
  if(this._state != null && this._state.addresses != null) {
    var keys = Object.keys(this._state.addresses);
    // Iterate over all server instances and set the  enableRecordQueryStats flag
    for(var i = 0; i < keys.length; i++) {
      this._state.addresses[keys[i]].enableRecordQueryStats(enable);
    }
  } else if(Array.isArray(this.servers)) {
    for(var i = 0; i < this.servers.length; i++) {
      this.servers[i].enableRecordQueryStats(enable);
    }
  }
}

/**
 * @ignore
 */
ReplSet.prototype.disconnect = function(callback) {
  this.close(callback);
}

/**
 * @ignore
 */
ReplSet.prototype.close = function(callback) {
  var self = this;
  // Disconnect
  this._serverState = 'disconnected';
  // Close all servers
  if(this._state && this._state.addresses) {
    var keys = Object.keys(this._state.addresses);
    // Iterate over all server instances
    for(var i = 0; i < keys.length; i++) {
      this._state.addresses[keys[i]].close();
    }
  }

  // If we have a strategy stop it
  if(this.strategyInstance) {
    this.strategyInstance.stop();
  }
  // Shut down HA if running connection
  if(this._haServer) this._haServer.close();

  // If it's a callback
  if(typeof callback == 'function') callback(null, null);
}

/**
 * Auto Reconnect property
 * @ignore
 */
Object.defineProperty(ReplSet.prototype, "autoReconnect", { enumerable: true
  , get: function () {
      return true;
    }
});

/**
 * Get Read Preference method
 * @ignore
 */
Object.defineProperty(ReplSet.prototype, "readPreference", { enumerable: true
  , get: function () {
      if(this._readPreference == null && this.readSecondary) {
        return ReadPreference.SECONDARY_PREFERRED;
      } else if(this._readPreference == null && !this.readSecondary) {
        return ReadPreference.PRIMARY;
      } else {
        return this._readPreference;
      }
    }
});

/**
 * Db Instances
 * @ignore
 */
Object.defineProperty(ReplSet.prototype, "dbInstances", {enumerable:true
  , get: function() {
    var servers = this.allServerInstances();
    return servers.length > 0 ? servers[0].dbInstances : [];
  }
})

/**
 * Just make compatible with server.js
 * @ignore
 */
Object.defineProperty(ReplSet.prototype, "host", { enumerable: true
  , get: function () {
      if (this.primary != null) return this.primary.host;
    }
});

/**
 * Just make compatible with server.js
 * @ignore
 */
Object.defineProperty(ReplSet.prototype, "port", { enumerable: true
  , get: function () {
      if (this.primary != null) return this.primary.port;
    }
});

/**
 * Get status of read
 * @ignore
 */
Object.defineProperty(ReplSet.prototype, "read", { enumerable: true
  , get: function () {
      return this.secondaries.length > 0 ? this.secondaries[0] : null;
    }
});

/**
 * Get list of secondaries
 * @ignore
 */
Object.defineProperty(ReplSet.prototype, "secondaries", {enumerable: true
  , get: function() {
      var keys = Object.keys(this._state.secondaries);
      var array = new Array(keys.length);
      // Convert secondaries to array
      for(var i = 0; i < keys.length; i++) {
        array[i] = this._state.secondaries[keys[i]];
      }
      return array;
    }
});

/**
 * Get list of all secondaries including passives
 * @ignore
 */
Object.defineProperty(ReplSet.prototype, "allSecondaries", {enumerable: true
  , get: function() {
      return this.secondaries.concat(this.passives);
    }
});

/**
 * Get list of arbiters
 * @ignore
 */
Object.defineProperty(ReplSet.prototype, "arbiters", {enumerable: true
  , get: function() {
      var keys = Object.keys(this._state.arbiters);
      var array = new Array(keys.length);
      // Convert arbiters to array
      for(var i = 0; i < keys.length; i++) {
        array[i] = this._state.arbiters[keys[i]];
      }
      return array;
    }
});

/**
 * Get list of passives
 * @ignore
 */
Object.defineProperty(ReplSet.prototype, "passives", {enumerable: true
  , get: function() {
      var keys = Object.keys(this._state.passives);
      var array = new Array(keys.length);
      // Convert arbiters to array
      for(var i = 0; i < keys.length; i++) {
        array[i] = this._state.passives[keys[i]];
      }
      return array;
    }
});

/**
 * Master connection property
 * @ignore
 */
Object.defineProperty(ReplSet.prototype, "primary", { enumerable: true
  , get: function () {
      return this._state != null ? this._state.master : null;
    }
});

/**
 * @ignore
 */
// Backward compatibility
exports.ReplSetServers = ReplSet;
