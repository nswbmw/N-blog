
/**
 * Module dependencies.
 */

var Agent = require('superagent').agent
	, methods = require('methods')
	, http = require('http')
	, Test = require('./test');

/**
 * Expose `Agent`.
 */

module.exports = TestAgent;

/**
 * Initialize a new `TestAgent`.
 * 
 * @param {Function|Server} app
 * @api public
 */

function TestAgent(app){
	if (!(this instanceof TestAgent)) return new TestAgent(app);
	if ('function' == typeof app) app = http.createServer(app);
	Agent.call(this);
	this.app = app;
}

/**
 * Inherits from `Agent.prototype`.
 */

TestAgent.prototype.__proto__ = Agent.prototype;

// override HTTP verb methods

methods.forEach(function(method){
  var name = 'delete' == method ? 'del' : method;

  method = method.toUpperCase();
  TestAgent.prototype[name] = function(url, fn){
    var req = new Test(this.app, method, url);

    req.on('response', this.saveCookies.bind(this));
    req.on('redirect', this.saveCookies.bind(this));
    req.on('redirect', this.attachCookies.bind(this, req));
    this.attachCookies(req);

    return req;
  };
});