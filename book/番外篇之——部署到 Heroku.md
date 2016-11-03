## 使用 MongoHQ ##

在把我们的博客部署到 Heroku 之前，我们首先学习下如何使用 MongoHQ 。MongoHQ 是一个提供 MongoDB 存储服务的云平台，使用起来非常简单，提供了在线查询和修改数据库的功能。MongoHQ 的免费套餐提供了 512MB 的存储空间。

### 注册 ###

[https://bridge.mongohq.com/signup](https://bridge.mongohq.com/signup)

### 创建一个数据库 ###

注册后，选择一个 **Free** 的数据库类型，并给数据库起一个名字，点击 **Create Database** 创建数据库。此时跳转到如下界面：

![](https://github.com/nswbmw/N-blog/blob/master/public/images/19.1.jpg?raw=true)

如图所示，我们可以在命令行中连接远程数据库，也可以通过 Mongo URL 使用数据库。接下来，我们修改博客的代码，使用 MongoHQ 提供的云端数据库取代使用本地数据库。

首先，我们需要给数据库添加一个用户。点击左侧的 **Admin** ，然后点击 **Users** 进入用户管理页面。在 username 和 password 处分别填写用户名和密码：

    db.addUser('username','password')

点击 **Add user** 添加用户。

修改 settings.js 为：

    module.exports = { 
      cookieSecret: 'myblog', 
      url: 'your_Mongo_URI'
    };

将 your\_Mongo\_URI 替换为你自己创建的数据库的 URL ，将 `<user>` 和 `<password>` 分别替换为刚才添加的用户的名字和密码。

打开 app.js ，将 `app.use(express.session(...));` 修改为：

    app.use(express.session({
      secret: settings.cookieSecret,
      cookie: {maxAge: 1000 * 60 * 60 * 24 * 30},//30 days
      url: settings.url
    }));

删除 db.js ，打开 post.js 、 user.js 和 comment.js ，均作以下修改：

- 将 `mongodb = require('./db')` 修改为 `mongodb = require('mongodb').Db`
- 添加 `var settings = require('../settings');`
- 将所有 `mongodb.open(function (err, db) {` 修改为 `mongodb.connect(settings.url, function (err, db) {`
- 将所有 `mongodb.close();` 修改为 `db.close();`

现在，无需启动你的本地数据库，运行你的博客试试吧~

**注意**：Heroku 也提供了 MongoHQ 的 Add-ons ，但需要填写信用卡信息，所以我们这里直接使用外链的 MongoHQ 。

## 部署到 Heroku ##

Heroku 是一个主流的 PaaS 提供商，在开发人员中广受欢迎。这个服务围绕着基于 Git 的工作流设计，假如你熟悉 Git ，那部署就十分简单。这个服务原本是为托管 Ruby 应用程序而设计的，但 Heroku 之后加入了对 Node.js 、Clojure 、Scala 、Python 和 Java 等语言的支持。Heroku 的基础服务是免费的。

下面我们使用 Heroku 部署我们的博客。

### 注册 ###

[https://www.heroku.com/](https://www.heroku.com/)

### 创建一个应用 ###

注册成功后，就进入了控制面板页面，如图所示：

![](https://github.com/nswbmw/N-blog/blob/master/public/images/19.2.jpg?raw=true)

点击 **Create a new app** ，填写独一无二的应用名称后，点击 **creat app** 即创建成功，然后点击 **Finish up** 。

此时跳转到控制面板页，并且可以看到我们创建的应用了。我们通过 **应用名称.herokuapp.com** 即可访问我们的应用主页。如图所示：

![](https://github.com/nswbmw/N-blog/blob/master/public/images/19.3.jpg?raw=true)

### 安装 Heroku Toolbelt ###

Heroku 官方提供了 Heroku Toolbelt 工具更方便地部署和管理应用。它包含三个部分：

- **Heroku client** ：创建和管理 Heroku 应用的命令行工具
- **Foreman** ：一个在本地运行你的 app 的不错的选择
- **Git** ：分布式版本控制工具，用来把应用推送到 Heroku

Heroku Toolbelt 下载地址：[https://toolbelt.heroku.com/](https://toolbelt.heroku.com/) 。

**注意**：假如你的电脑上已经安装了 Git ，那么在安装的时候选择 **Custom Installation** 并去掉安装 Git 的选项，否则选择 **Full Installation** 。

安装成功后，打开 Git Bash ，输入 `heroku login` ，然后输入在 Heroku 注册的帐号和密码进行登录。Git 会检测是否有 SSH 密钥，如果有，则使用此密钥并上传，如果没有，则创建一个密钥并上传。

**Tips**：SSH 密钥通常用于授予用户访问服务器的权限。可将它们用于某些配置中，以便无需密码即可访问服务器。许多 PaaS 提供商都使用了此功能。


### Procfile ###

在工程的根目录下新建一个 **Procfile** 文件，添加如下内容：

    web: node app.js

**Procfile** 文件告诉了服务器该使用什么命令启动一个 web 服务，这里我们通过 `node app.js` 执行 Node 脚本。为什么这里声明了一个 `web` 类型呢？官方解释为：

> The name “web” is important here. It declares that this process type will be attached to the HTTP routing stack of Heroku, and receive web traffic when deployed.

### 上传应用 ###

打开 Git Bash ，输入：

    $ git init
    $ git add .
    $ git commit -m "init"
    $ git remote add heroku git@heroku.com:yourAppName.git

**注意**：将 yourAppName 修改为你自己的应用名。

在 push 到 heroku 服务器之前，我们还需要做一个工作。由于我国某些政策的原因，我们需到 **~/.ssh/** 目录下，新建一个 **config** 文件，内容如下：

    Host heroku.com
    User yourName
    Hostname 107.21.95.3
    PreferredAuthentications publickey
    IdentityFile ~/.ssh/id_rsa
    port 22

然后回到 Git Bash ，输入：

    $ git push heroku master

稍等片刻即上传成功。现在你就可以访问 **http://yourAppName.herokuapp.com/** 了，如图所示：

![](https://github.com/nswbmw/N-blog/blob/master/public/images/19.4.jpg?raw=true)

**注意**：假如出现了 **Application Error**，可能是没有启动应用，到应用面板页勾选 **web node app.js** ，然后点击 **Apply Changes** 启动应用。