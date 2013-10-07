
/**
 * Module dependencies.
 */

var should = require('../');
var util = require('util');

function err(fn, msg) {
  try {
    fn();
    should.fail('expected an error');
  } catch (err) {
    should.equal(msg, err.message);
    should(err.stack, 'Expected error to have an stack trace');

    var stackTraceFirstLine = err.stack.split('\n')[1];
    var message = 'Expected error to have a proper stack trace showing the file names';
    should(stackTraceFirstLine, message); 
    stackTraceFirstLine.should.match(/at\s*[\S]+/, message);
  }
}

function err_should_exist(obj) {
  err(function () {
    should.exist(obj);
  }, 'expected ' + util.inspect(obj) + ' to exist');
}

function err_should_not_exist(obj) {
  err(function () {
    should.not.exist(obj);
  }, 'expected ' + util.inspect(obj) + ' to not exist');
}

module.exports = {
  
  // static should.exist() pass:
  
  'test static should.exist() pass w/ bool': function () {
    should.exist(false);
  },
  
  'test static should.exist() pass w/ number': function () {
    should.exist(0);
  },
  
  'test static should.exist() pass w/ string': function () {
    should.exist('');
  },
  
  'test static should.exist() pass w/ object': function () {
    should.exist({});
  },
  
  'test static should.exist() pass w/ array': function () {
    should.exist([]);
  },
  
  // static should.exist() fail:
  
  'test static should.exist() fail w/ null': function () {
    err_should_exist(null);
  },
  
  'test static should.exist() fail w/ undefined': function () {
    err_should_exist(undefined);
  },
  
  // static should.not.exist() pass:
  
  'test static should.not.exist() pass w/ null': function () {
    should.not.exist(null);
  },
  
  'test static should.not.exist() pass w/ undefined': function () {
    should.not.exist(undefined);
  },
  
  // static should.not.exist() fail:
  
  'test static should.not.exist() fail w/ bool': function () {
    err_should_not_exist(false);
  },
  
  'test static should.not.exist() fail w/ number': function () {
    err_should_not_exist(0);
  },
  
  'test static should.not.exist() fail w/ string': function () {
    err_should_not_exist('');
  },
  
  'test static should.not.exist() fail w/ object': function () {
    err_should_not_exist({});
  },
  
  'test static should.not.exist() fail w/ array': function () {
    err_should_not_exist([]);
  },
  
};
