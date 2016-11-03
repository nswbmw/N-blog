目前为止，我们都是这样处理请求的，比如：当用户访问某个文章页的时候，系统会创建一个数据库连接，通过该连接到数据库中查找并返回该文章的数据，然后关闭该连接。但是当我们的博客访问量巨大的时候，频繁的创建和销毁连接会产生非常大的系统开销。这个时候，我们就需要引入数据库连接池了。

什么是连接池（connection pool）呢？维基百科中是这样定义的：

> connection pool is a cache of database connections maintained so that the connections can be reused when future requests to the database are required.

说白了就是，我们一开始就创建一沓数据库连接，并保持长连不断开。当我们需要访问数据库的时候，就去那一沓连接（俗称连接池）中拿来一个用，用完（对数据库增删改查完）后再把这条连接释放到连接池中（依然不断开）。这样我们只在一开始创建一沓数据库连接时会有一些开销，而这种开销总比频繁的创建和销毁连接小得多。

在 Node.js 中，我们可以使用 generic-pool 这个模块帮助我们创建和管理数据库连接池。

首先，在 package.json 中添加对 generic-pool 的依赖：

    "generic-pool": "*"

并 npm install 安装 generic-pool 模块。

打开 db.js ，将：

    module.exports = new Db(settings.db, new Server(settings.host, settings.port), {safe: true});

修改为：

    module.exports = function() {
      return new Db(settings.db, new Server(settings.host, settings.port), {safe: true, poolSize: 1});
    }

这里我们导出一个函数，每次调用该函数则创建一个数据库连接。

打开 post.js ，将：

    var mongodb = require('./db'),
        markdown = require('markdown').markdown;

修改为：

    var Db = require('./db');
    var markdown = require('markdown').markdown;
    var poolModule = require('generic-pool');
    var pool = poolModule.Pool({
      name     : 'mongoPool',
      create   : function(callback) {
        var mongodb = Db();
        mongodb.open(function (err, db) {
          callback(err, db);
        })
      },
      destroy  : function(mongodb) {
        mongodb.close();
      },
      max      : 100,
      min      : 5,
      idleTimeoutMillis : 30000,
      log      : true
    });

以上就创建了一个 mongodb 连接池，其中 name 指明该连接池的名字，create 指明创建一条数据库连接的方法，并返回创建的连接，destroy 指明如何销毁连接，max 指明连接池中最大连接数，min 指明连接池中最小连接数，idleTimeoutMillis 指明不活跃连接销毁的毫秒数，这里为 30000 即当一条连接 30 秒处于不活跃状态（即没有被使用过）时则销毁该连接。log 指明是否打印连接池日志，这里我们选择打印。

如何使用连接池呢？很简单。只需将所有:

    mongodb.open(function (err, db) {
      ...
      mongodb.close();
    });

修改为：

    pool.acquire(function (err, mongodb) {
      ...
      pool.release(mongodb);
    });

这里我们使用 `pool.acquire` 去连接池中获取一条可用连接，使用完毕后通过 `pool.release` 释放该连接，而不是 close 掉。

读者可自行完成剩余的修改工作。