/**
 * Module dependencies.
 */

var Compiler = require('../visitor/compiler')
  , nodes = require('../nodes')
  , parse = require('url').parse
  , relative = require('path').relative
  , dirname = require('path').dirname
  , extname = require('path').extname
  , utils = require('../utils');

/**
 * Return a url() function with the given `options`.
 *
 * Options:
 *
 *    - `paths` resolution path(s), merged with general lookup paths
 *
 * Examples:
 *
 *    stylus(str)
 *      .set('filename', __dirname + '/css/test.styl')
 *      .define('url', stylus.resolver({ paths: [__dirname + '/public'] }))
 *      .render(function(err, css){ ... })
 *
 * @param {Object} options
 * @return {Function}
 * @api public
 */

module.exports = function(options) {
  options = options || {};

  var _paths = options.paths || [];

  function url(url) {
    // Compile the url
    var compiler = new Compiler(url);
    compiler.isURL = true;
    var url = url.nodes.map(function(node){
      return compiler.visit(node);
    }).join('');

    // Parse literal 
    var url = parse(url)
      , literal = new nodes.Literal('url("' + url.href + '")')
      , paths = _paths.concat(this.paths)
      , found;

    // Absolute
    if (url.protocol) return literal;

    // Lookup
    var found = utils.lookup(url.pathname, paths);

    // Failed to lookup
    if (!found) return literal;

    if (this.includeCSS && extname(found) == '.css') {
      return new nodes.Literal(found);
    } else {
      return new nodes.Literal('url("' + relative(dirname(this.filename), found) +'")');
    }
  };

  url.raw = true;
  return url;
};
