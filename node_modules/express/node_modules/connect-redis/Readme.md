# Connect Redis

connect-redis is a Redis session store backed by [node_redis](http://github.com/mranney/node_redis), and is insanely fast :). Requires redis >= `2.0.0` for the _SETEX_ command.

 connect-redis `>= 1.0.0` support only connect `>= 1.0.0`.

## Installation

	  $ npm install connect-redis

## Options
  
  - `client` An existing redis client object you normally get from `redis.createClient()`
  - `host` Redis server hostname
  - `port` Redis server portno
  - `ttl` Redis session TTL in seconds
  - `db` Database index to use
  - `pass` Password for Redis authentication
  - `prefix` Key prefix defaulting to "sess:"
  - ...    Remaining options passed to the redis `createClient()` method.

## Usage

 Due to npm 1.x changes, we now need to pass connect to the function `connect-redis` exports in order to extend `connect.session.Store`:

    var connect = require('connect')
	 	  , RedisStore = require('connect-redis')(connect);

    connect()
      .use(connect.session({ store: new RedisStore(options), secret: 'keyboard cat' }))
 

 This means express users may do the following, since `express.session.Store` points to the `connect.session.Store` function:
 
    var RedisStore = require('connect-redis')(express);

# License

  MIT
