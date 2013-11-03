
/*!
 * Connect - urlencoded
 * Copyright(c) 2010 Sencha Inc.
 * Copyright(c) 2011 TJ Holowaychuk
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var utils = require('../utils');
var getBody = require('raw-body');
var bytes = require('bytes');
var qs = require('qs');

/**
 * Urlencoded:
 *
 *  Parse x-ww-form-urlencoded request bodies,
 *  providing the parsed object as `req.body`.
 *
 * Options:
 *
 *    - `limit`  byte limit [1mb]
 *   - `verify`  synchronous verification function.
 *      should have signature (req, res, buffer).
 *      should throw an error on failure.
 *
 * @param {Object} options
 * @return {Function}
 * @api public
 */

exports = module.exports = function(options){
  options = options || {};
  var verify = typeof options.verify === 'function' && options.verify;

  var limit = !options.limit ? bytes('1mb')
    : typeof options.limit === 'number' ? options.limit
    : typeof options.limit === 'string' ? bytes(options.limit)
    : null

  return function urlencoded(req, res, next) {
    if (req._body) return next();
    req.body = req.body || {};

    if (!utils.hasBody(req)) return next();

    // check Content-Type
    if ('application/x-www-form-urlencoded' != utils.mime(req)) return next();

    // flag as parsed
    req._body = true;

    // parse
    getBody(req, {
      limit: limit,
      expected: req.headers['content-length']
    }, function (err, buf) {
      if (err) return next(err);

      if (verify) {
        try {
          verify(req, res, buf)
        } catch (err) {
          if (!err.status) err.status = 403;
          return next(err);
        }
      }

      buf = buf.toString('utf8').trim();

      try {
        req.body = buf.length
          ? qs.parse(buf, options)
          : {};
      } catch (err){
        err.body = buf;
        return next(err);
      }
      next();
    })
  }
};
