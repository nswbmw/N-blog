Async 是一个流行的异步编程类库，提供了直接而强大的 JavaScript 异步功能。虽然是为 Node.js 设计的，但是它也可以直接在浏览器中使用。

Async 提供了大约 20 个函数，包括常用的 map, reduce, filter, forEach 等等，也有常用的异步流程控制函数，包括 parallel, series, waterfall 等等。所有这些函数都是假设你遵循了 Node.js 的约定：在异步函数的最后提供一个回调函数作为参数。

Async 包括三部分：

1. 流程控制：简化十种常见流程的处理
2. 集合处理：如何使用异步操作处理集合中的数据
3. 工具类：几个常用的工具类

这里我们不会讲解 Async 的使用，读者可去以下链接学习 Async 的相关知识：

- Async ： [https://github.com/caolan/async](https://github.com/caolan/async)
- stackoverflow ： [http://stackoverflow.com/](http://stackoverflow.com/)
- Async详解之一：流程控制 ： [http://freewind.me/blog/20120515/917.html](http://freewind.me/blog/20120515/917.html)
- Async详解之二：工具类 ： [http://freewind.me/blog/20120517/931.html](http://freewind.me/blog/20120517/931.html)
- Async详解之三：集合操作 ： [http://freewind.me/blog/20120518/932.html](http://freewind.me/blog/20120518/932.html)
- Nodejs异步流程控制Async ： [http://blog.fens.me/nodejs-async/](http://blog.fens.me/nodejs-async/)

我们在操作数据库的时候经常会这样写，以 `Post.getOne` 为例：

    Post.getOne = function(name, day, title, callback) { 
      mongodb.open(function (err, db) {
        if (err) { ... }
        db.collection('posts', function (err, collection) {
          if (err) { ... }
          collection.findOne({ ... }, function (err, doc) {
            if (err) { ... }
            collection.update({ ... }, function (err) {
              mongodb.close();
              callback( ... );
            });
          });
        });
      });
    };

这就是典型的深度嵌套回调，代码看起来并不美观。下面我们使用 Async 解决这个问题。

首先，在 `package.json` 中添加对 Async 的依赖：

    "async": "*"

并 `npm install` 安装 Async 包。

在使用 Async 之前，我们先学习下 `async.waterfall` 的基本用法。

`waterfall(tasks, [callback])` ：多个函数依次执行，且前一个的输出为后一个的输入，即每一个函数产生的值，都将传给下一个函数。如果中途出错，后面的函数将不会被执行。错误信息以及之前产生的结果，将传给 waterfall 最终的 callback，一个简单的例子：

    var async = require('async');

    async.waterfall([
        function(callback){
            callback(null, 'one', 'two');
        },
        function(arg1, arg2, callback){
            console.log('arg1 => ' + arg1);
            console.log('arg2 => ' + arg2);
            callback(null, 'three');
        },
        function(arg3, callback){
            console.log('arg3 => ' + arg3);
            callback(null, 'done');
        }
    ], function (err, result) {
       console.log('err => ' + err);
       console.log('result => ' + result);
    });

运行结果为：

    arg1 => one
    arg2 => two
    arg3 => three
    err => null
    result => done

将 `callback(null, 'three');` 修改为：

    callback('error occurred !', 'three');

运行结果为：

    arg1 => one
    arg2 => two
    err => error occurred !
    result => three

我们以修改 user.js 为例，将 user.js 修改如下：

    var mongodb = require('./db');
    var crypto = require('crypto');
    var async = require('async');

    function User(user) {
      this.name = user.name;
      this.password = user.password;
      this.email = user.email;
    };

    module.exports = User;

    User.prototype.save = function(callback) {
      var md5 = crypto.createHash('md5'),
          email_MD5 = md5.update(this.email.toLowerCase()).digest('hex'),
          head = "http://www.gravatar.com/avatar/" + email_MD5 + "?s=48";
      var user = {
          name: this.name,
          password: this.password,
          email: this.email,
          head: head
      };
      async.waterfall([
        function (cb) {
          mongodb.open(function (err, db) {
            cb(err, db);
          });
        },
        function (db, cb) {
          db.collection('users', function (err, collection) {
            cb(err, collection);
          });
        },
        function (collection, cb) {
          collection.insert(user, {
            safe: true
          }, function (err, user) {
            cb(err, user);
          });
        }
      ], function (err, user) {
        mongodb.close();
        callback(err, user[0]);
      });
    };

    User.get = function(name, callback) {
      async.waterfall([
        function (cb) {
          mongodb.open(function (err, db) {
            cb(err, db);
          });
        },
        function (db, cb) {
          db.collection('users', function (err, collection) {
            cb(err, collection);
          });
        },
        function (collection, cb) {
          collection.findOne({
            name: name
          }, function (err, user) {
            cb(err, user);
          });
        }
      ], function (err, user) {
        mongodb.close();
        callback(err, user);
      });
    };

关于 Async 的使用详见 [https://github.com/caolan/async](https://github.com/caolan/async) ，读者可自行完成剩余的修改工作。