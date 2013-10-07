
/**
 * Module dependencies.
 */

var assert = require('assert')
  , connect = require('connect')
  , RedisStore = require('./')(connect);

var store = new RedisStore;
var store_alt = new RedisStore({ db: 15 });

store.client.on('connect', function(){
  // #set()
  store.set('123', { cookie: { maxAge: 2000 }, name: 'tj' }, function(err, ok){
    assert.ok(!err, '#set() got an error');
    assert.ok(ok, '#set() is not ok');

    // #get()
    store.get('123', function(err, data){
      assert.ok(!err, '#get() got an error');
      assert.deepEqual({ cookie: { maxAge: 2000 }, name: 'tj' }, data);

      // #set null
      store.set('123', { cookie: { maxAge: 2000 }, name: 'tj' }, function(){
        store.destroy('123', function(){
         console.log('done');
         store.client.end(); 
         store_alt.client.end();
        });
      });
      throw new Error('Error in fn');
    });
  });
});

process.once('uncaughtException', function (err) {
  assert.ok(err.message === 'Error in fn', '#get() catch wrong error');
});