var util   = require('util');

var Codes = {
  RequestError: 'RequestError',
  NotFound: 'NotFound',
  DBError: 'DBError',
  ServerError: 'ServerError',
  MongoPoolError: 'MongoPoolError'
};

function Exception(code, msg) {
  if (!(this instanceof Exception)) {
    return new Exception(code, msg);
  }

  Error.captureStackTrace(this, Exception);
  this.code = code;
  this.message = msg || 'Exception: ' + '[' + code + ']';
}
util.inherits(Exception, Error);

module.exports = Exception;

Object.keys(Codes).forEach(function (key) {
  module.exports[key] = Codes[key];
});