
var redis = require('./lib/redis')
  , times = 100000;

var n = times
  , pending = n
  , client = redis.createClient()
  , start = new Date;

client.on('connect', function(){
  while (n--) {
    client.set('foo:' + n, 'bar', function(err){
      if (err) throw err;
      --pending || report();
    });
  }
});

function report() {
  console.log('\x1b[33m%d\x1b[0m sets in \x1b[32m%d\x1b[0m milliseconds', times, new Date - start);
}