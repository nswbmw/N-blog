Mongoose 是 MongoDB 数据库的模型工具，为 Node.js 设计，工作于异步环境下，基于 node-mongodb-native。

与使用 node-mongodb-native 相比，使用 Mongoose 可以简化不少代码。这里我们不会讲解 Mongoose 的使用，读者可去以下链接学习 Mongoose 的相关知识：

- mongoosejs ： [http://mongoosejs.com/](http://mongoosejs.com/)
- stackoverflow ： [http://stackoverflow.com/](http://stackoverflow.com/)
- Mongoose学习参考文档——基础篇 ： [http://cnodejs.org/topic/504b4924e2b84515770103dd](http://cnodejs.org/topic/504b4924e2b84515770103dd)
- Mongoose 基本功能使用 ： [http://www.csser.com/board/4f4e92dbeb0defac5700011e](http://www.csser.com/board/4f4e92dbeb0defac5700011e)
-  Mongoose - 让NodeJS更容易操作Mongodb数据库 ： [http://www.csser.com/board/4f3f516e38a5ebc9780004fe](http://www.csser.com/board/4f3f516e38a5ebc9780004fe)

下面我们尝试在博客应用中使用 Mongoose 。

首先，在 `package.json` 中添加对 mongoose 的依赖：

    "mongoose": "*"

并 `npm install` 安装 mongoose 包。

**注意**：完全使用 mongoose 的话可以删除 mongodb 模块，但我们这里只是局部使用 mongoose ，所以暂时保留。

修改 user.js 如下：

    var crypto = require('crypto');
    var mongoose = require('mongoose');
    mongoose.connect('mongodb://localhost/blog');// 优化可参考 [#57](https://github.com/nswbmw/N-blog/issues/57)

    var userSchema = new mongoose.Schema({
      name: String,
      password: String,
      email: String,
      head: String
    }, {
      collection: 'users' 
    });

    var userModel = mongoose.model('User', userSchema);

    function User(user) {
      this.name = user.name;
      this.password = user.password;
      this.email = user.email;
    };

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

      var newUser = new userModel(user);

      newUser.save(function (err, user) {
        if (err) {
          return callback(err);
        }
        callback(null, user);
      });
    };

    User.get = function(name, callback) {
      userModel.findOne({name: name}, function (err, user) {
        if (err) {
          return callback(err);
        }
        callback(null, user);
      });
    };

    module.exports = User;

**注意**：Mongoose 会自动为每一个文档添加一个 `__v` 即 versionKey （版本锁），如下所示：

    > db.users.find()
    { "name" : "nswbmw", "password" : "d41d8cd98f00b204e9800998ecf8427e", "email" :
    "gxqzk@126.com", "head" : "http://www.gravatar.com/avatar/11c35a5b58d99d2c8a9501
    65b795917d?s=48", "_id" : ObjectId("527ae6e8d38086540a000001"), "__v" : 0 }

关于 versionKey 的使用详见： [http://mongoosejs.com/docs/guide.html#versionKey](http://mongoosejs.com/docs/guide.html#versionKey) 。

读者可自行完成剩余的修改工作。