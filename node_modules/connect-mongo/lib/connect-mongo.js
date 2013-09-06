/*!
 * connect-mongo
 * Copyright(c) 2011 Casey Banner <kcbanner@gmail.com>
 * MIT Licensed
 */

/**
 * Module dependencies
 */

var mongo = require('mongodb');
var url = require('url');


/**
 * Default options
 */

var defaultOptions = {host: '127.0.0.1',
                      port: 27017,
                      stringify: true,
                      collection: 'sessions',
                      auto_reconnect: false,
                      ssl: false,
                      w: 1};

module.exports = function(connect) {
  var Store = connect.session.Store;

  /**
   * Initialize MongoStore with the given `options`.
   * Calls `callback` when db connection is ready (mainly for testing purposes).
   * 
   * @param {Object} options
   * @param {Function} callback
   * @api public
   */

  function MongoStore(options, callback) {
    options = options || {};
    Store.call(this, options);

    if(options.url) {
      var db_url = url.parse(options.url);

      if (db_url.port) {
        options.port = parseInt(db_url.port);
      }
      
      if (db_url.pathname != undefined) {
        var pathname = db_url.pathname.split('/');

        if (pathname.length >= 2 && pathname[1]) {
          options.db = pathname[1];
        }
        
        if (pathname.length >= 3 && pathname[2]) {
          options.collection = pathname[2];
        }
      }
      
      if (db_url.hostname != undefined) {
        options.host = db_url.hostname;
      }

      if (db_url.auth != undefined) {
        var auth = db_url.auth.split(':');

        if (auth.length >= 1) {
          options.username = auth[0];
        }
        
        if (auth.length >= 2) {
          options.password = auth[1];
        }
      }
    }
  
    if (options.mongoose_connection){
      if (options.mongoose_connection.user && options.mongoose_connection.pass) {
        options.username = options.mongoose_connection.user;
        options.password = options.mongoose_connection.pass;
      }

      this.db = new mongo.Db(options.mongoose_connection.db.databaseName,
                             new mongo.Server(options.mongoose_connection.db.serverConfig.host,
                                              options.mongoose_connection.db.serverConfig.port,
                                              options.mongoose_connection.db.serverConfig.options
                                             ),
                             { w: options.w || defaultOptions.w });

    } else {
      if(!options.db) {
        throw new Error('Required MongoStore option `db` missing');
      }

      if (typeof options.db == "object") {
        this.db = options.db; // Assume it's an instantiated DB Object
      }
      else {
        this.db = new mongo.Db(options.db,
                               new mongo.Server(options.host || defaultOptions.host,
                                                options.port || defaultOptions.port,
                                                {
                                                  auto_reconnect: options.auto_reconnect ||
                                                  defaultOptions.auto_reconnect,
                                                  ssl: options.ssl || defaultOptions.ssl
                                                }),
                               { w: options.w || defaultOptions.w });
      }
    }
    this.db_collection_name = options.collection || defaultOptions.collection;

    if (options.hasOwnProperty('stringify') ?
        options.stringify : defaultOptions.stringify) {
      this._serialize_session = JSON.stringify;
      this._unserialize_session = JSON.parse;
    } else {
      this._serialize_session = function(x) { return x; };
      this._unserialize_session = function(x) { return x; };
    }
    
    var self = this;
    this._get_collection = function(callback) {
      if (self.collection) {
        callback && callback(self.collection);
      } else {
        self.db.collection(self.db_collection_name, function(err, collection) {
          if (err) {
            throw new Error('Error getting collection: ' + self.db_collection_name  + ' <' + err + '>');
          } else {
            self.collection = collection;

            // Make sure we have a TTL index on "expires", so mongod will automatically
            // remove expired sessions. expireAfterSeconds is set to 0 because we want 
            // mongo to remove anything expired without any additional delay.
            self.collection.ensureIndex({expires: 1}, {expireAfterSeconds: 0}, function(err, result) {
              if (err) {
                throw new Error('Error setting TTL index on collection : ' + self.db_collection_name + ' <' + err + '>');
              }
              
              callback && callback(self.collection);
            });
            
          }      
        });    
      }
    };
    if (this.db.openCalled) {
      this._get_collection(callback)
    }
    else {
      this.db.open(function(err, db) {
        if (err) {
          throw new Error('Error connecting to database <' + err + '>');
        }

        if (options.username && options.password) {
          db.authenticate(options.username, options.password, function () {
            self._get_collection(callback);
          });
        } else {
          self._get_collection(callback);
        }
      });
    }
  };

  /**
   * Inherit from `Store`.
   */

  MongoStore.prototype.__proto__ = Store.prototype;

  /**
   * Attempt to fetch session by the given `sid`.
   *
   * @param {String} sid
   * @param {Function} callback
   * @api public
   */
  
  MongoStore.prototype.get = function(sid, callback) {
    var self = this;
    this._get_collection(function(collection) {    
      collection.findOne({_id: sid}, function(err, session) {
        try {
          if (err) {
            callback && callback(err, null);
          } else {      
            
            if (session) {
              if (!session.expires || new Date < session.expires) {
                callback(null, self._unserialize_session(session.session));
              } else {
                self.destroy(sid, callback);
              }
            } else {
              callback && callback();
            }
          }
        } catch (err) {
          callback && callback(err);
        }
      });
    });
  };

  /**
   * Commit the given `sess` object associated with the given `sid`.
   *
   * @param {String} sid
   * @param {Session} sess
   * @param {Function} callback
   * @api public
   */

  MongoStore.prototype.set = function(sid, session, callback) {
    try {
      var s = {_id: sid, session: this._serialize_session(session)};

      if (session && session.cookie) {
        if (session.cookie.expires) {
          s.expires = new Date(session.cookie.expires);
        } else {
          // If there's no expiration date specified, it is 
          // browser-session cookie, as per the connect docs.
          // So we set the expiration to two-weeks from now,
          // as is common practice in the industry (e.g Django).
          var today = new Date(),
          twoWeeks = 1000 * 60 * 60 * 24 * 14;
          s.expires = new Date(today.getTime() + twoWeeks);
        }

        // Convert the cookie object to its JSON representation if possible
        // This gets rid of the duplicate object under session.cookie.data property
        s.session.cookie = session.cookie.toJSON ? session.cookie.toJSON() : session.cookie;
      }

      this._get_collection(function(collection) {
        collection.update({_id: sid}, s, {upsert: true, safe: true}, function(err, data) {
          if (err) {
            callback && callback(err);
          } else {
            callback && callback(null);
          }
        });
      });
    } catch (err) {
      callback && callback(err);
    }
  };

  /**
   * Destroy the session associated with the given `sid`.
   *
   * @param {String} sid
   * @param {Function} callback
   * @api public
   */

  MongoStore.prototype.destroy = function(sid, callback) {
    this._get_collection(function(collection) {
      collection.remove({_id: sid}, function() {
        callback && callback();
      });
    });
  };

  /**
   * Fetch number of sessions.
   *
   * @param {Function} callback
   * @api public
   */

  MongoStore.prototype.length = function(callback) {
    this._get_collection(function(collection) {
      collection.count({}, function(err, count) {
        if (err) {
          callback && callback(err);
        } else {
          callback && callback(null, count);
        }
      });
    });
  };

  /**
   * Clear all sessions.
   *
   * @param {Function} callback
   * @api public
   */

  MongoStore.prototype.clear = function(callback) {
    this._get_collection(function(collection) {
      collection.drop(function() {
        callback && callback();
      });
    });
  };
  
  return MongoStore;
};
