前面我们自己写了一个简单的登陆认证系统，即用户在登陆时，通过输入事先注册的用户名和密码，服务器确认用户的身份后，从而获得操作权限。这也是最传统的登陆认证方式。

随着互联网的不断开放与发展，又出现了一种新的登陆认证方式——第三方登陆认证，即我们常说的oAuth/oAuth2.0。

**什么是 oAuth？**

> OAUTH协议为用户资源的授权提供了一个安全的、开放而又简易的标准。与以往的授权方式不同之处是OAUTH的授权不会使第三方触及到用户的帐号信息（如用户名与密码），即第三方无需使用用户的用户名与密码就可以申请获得该用户资源的授权，因此OAUTH是安全的。

**什么是 Passport？**

> Passport是一个基于Node.js的认证中间件。极其灵活并且模块化，Passport可以很容易地跟任意基于Express的Web应用结合使用。

现在我们来修改代码，使得我们的博客既支持本地登陆又支持使用 GitHub 账户登录。

首先，登录 GitHub ，点击右上角的 Account settings ，然后点击左侧的 Applications ，然后点击右上角的 Register new application 创建一个 GitHub 应用。

创建成功后如下图所示：

![](https://raw.github.com/nswbmw/N-blog/master/public/images/25.1.jpg)

稍后我们将会用到 **Client ID** 、**Client Secret** 和 **Authorization callback URL**。

打开 package.json ，添加 passport 和 passport-github 模块：

    "passport": "*",
    "passport-github": "*"

并 npm install 安装这两个模块。

至此，准备工作都已完成，接下来我们修改代码支持使用 GitHub 账户登录。

首先，添加使用 GitHub 登陆的链接。打开 login.ejs，在：

    <%- include footer %>

上一行添加如下代码：

    <a href="/login/github">使用 GitHub 登录</a>

然后打开 app.js ，在 `var app = express();` 下添加如下代码：

    var passport = require('passport')
        , GithubStrategy = require('passport-github').Strategy;

在 `app.use(app.router);` 上添加一行代码：

    app.use(passport.initialize());//初始化 Passport

在 `if ('development' == app.get('env'))` 上添加如下代码：

    passport.use(new GithubStrategy({
      clientID: "xxx",
      clientSecret: "xxx",
      callbackURL: "xxx"
    }, function(accessToken, refreshToken, profile, done) {
      done(null, profile);
    }));

**注意**：将 clientID、clientSecret 和 callbackURL 分别替换为刚才创建 GitHub 应用得到的信息。

以上代码的意思是：我们定义了一个 Passport 策略，并尝试从 GitHub 获得授权，从 GitHub 登陆并授权成功后以跳转到 **callbackURL** 并以 JSON 形式返回用户的一些相关信息，并将这些信息存储在 `req.user` 中。

打开 index.js ，在上方添加一行代码：

    var passport = require('passport');

并在 `app.get('/login')` 后添加如下代码：

    app.get("/login/github", passport.authenticate("github", {session: false}));
    app.get("/login/github/callback", passport.authenticate("github", {
      session: false,
      failureRedirect: '/login',
      successFlash: '登陆成功！'
    }), function (req, res) {
      req.session.user = {name: req.user.username, head: "https://gravatar.com/avatar/" + req.user._json.gravatar_id + "?s=48"};
      res.redirect('/');
    });

这里我们可以直接使用 Express 的 session 功能，所以禁掉 Passport 的 session 功能，前面提到过 Passport 默认会将取得的用户信息存储在 `req.user` 中而不是 `req.session.user`，为了保持兼容，所以我们提取并序列化有用的数据保存到 `req.session.user` 中。

至此，我们的博客也支持 GitHub 登录了，是不是很简单？目前还存在三个问题：

1. GitHub 用户名和本地数据库用户名重名的问题。
2. 不能访问使用 GitHub 账户登录的用户的用户页。
3. 无法从 GitHub 获得用户的邮箱。

第一个问题的简单粗暴的解决方法是当用户以 GitHub 账户登录时，把获取的用户名到本地数据库查一下，若存在则禁止登录，若不存在则允许登陆。

第二个问题修改一下代码即可解决，删除 index.js 中 `app.get('/u/:name')` 内的那层判断数据库中是否存在该用户名的函数即可。

第三个问题暂时无法解决，因为 GitHub 返回的信息中并不包含有效的用户邮箱。