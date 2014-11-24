var MongoClient = require('mongodb').MongoClient;
var poolModule = require('generic-pool');

var options = require('../config').mongo || {};
var host = options.host || 'localhost';
var port = options.port || 27017;
var max = options.max || 100;
var min = options.min || 1;
var timeout = options.timeout || 30000;
var log = options.log || false;
var mongoUrl = '';
if(options.uri) {
  mongoUrl = options.uri || options.url;
} else {
  if (options.user && options.pass) {
    mongoUrl = 'mongodb://' + options.user + ':' + options.pass + '@' + host + ':' + port;
  } else {
    mongoUrl = 'mongodb://' + host + ':' + port;
  }
}

var mongoPool = poolModule.Pool({
  name     : 'mongodb',
  create   : function (callback) {
    MongoClient.connect(mongoUrl, {
      server: {poolSize: 1},
      native_parser: true
    }, callback);
  },
  destroy  : function(client) {client.close();},
  max      : max,
  min      : min, 
  idleTimeoutMillis : timeout,
  log : log 
});

module.exports = mongoPool;