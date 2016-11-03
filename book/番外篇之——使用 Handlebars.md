前面我们在 Express 中使用的 EJS 模板引擎进行渲染视图和页面的展示。当模版文件代码比较多且逻辑复杂时，代码就变得非常难看了，满眼的 `<%` 和 `%>`。下面我们尝试使用 Handlebars 这个模版引擎替换 EJS ，代码会变得整洁许多。

Handlebars 是 JavaScript 一个语义模板库，通过对 view 和 data 的分离来快速构建 Web 模板。它采用 "Logic-less template"（无逻辑模版）的思路，在加载时被预编译，而不是到了客户端执行到代码时再去编译，这样可以保证模板加载和运行的速度。Handlebars 兼容 Mustache，你可以在 Handlebars 中导入 Mustache 模板。

Handlebars 的语法也非常简单易学。这里我们不会讲解 Handlebars 的语法，官网（ [http://handlebarsjs.com/](http://handlebarsjs.com/) ）的文档非常全面。

我们使用 express-handlebars 这个第三方包添加对 Handlebars 的支持。

**注意**：也许你会非常自觉的认为应该使用 `npm install handlebars` 安装 Handlebars 然后开始大刀阔斧地修改代码。但在这里我们不使用官方提供的 Handlebars 包，Express 默认支持的模板引擎中不包含 Handlebars ，虽然我们可以通过 consolidate.js + handlebars 实现，但仍然有一个缺点是不支持从一个模版文件加载另一个模版文件，而在 EJS 中可以使用 `<%- include someTemplate %>` 轻松实现。express-handlebars 包弥补了该缺点，所以我们使用 express-handlebars 来完成代码的修改。

首先，打开 package.json ，删除 ejs 并添加对 express-handlebars 的依赖：

    "express-handlebars": "*"

并 `npm install` 安装 express-handlebars 包。

打开 app.js ，添加一行：

    var exphbs  = require('express-handlebars');

然后将：

    app.set('view engine', 'ejs');

修改为：

    app.engine('hbs', exphbs({
      layoutsDir: 'views',
      defaultLayout: 'layout',
      extname: '.hbs'
    }));
    app.set('view engine', 'hbs');

这里我们注册模板引擎处理后缀名为 hbs 的文件，然后通过 `app.set('view engine', 'hbs');` 设置模板引擎。以上参数的意思是：

-  `layoutsDir: 'views'`： 设置布局模版文件的目录为 views 文件夹
-  `defaultLayout: 'layout'`： 设置默认的页面布局模版为 layout.hbs 文件，跟 Express 2.x 中的 layout.ejs 作用类似。
-  `extname: '.hbs'`： 模版文件使用的后缀名，这个 `.hbs` 是我们自定的，我们当然可以使用 `.html` 和 `.handlebars` 等作为后缀，只需把以上的 `hbs` 全部替换即可。

我们还可以设置其他几个参数，详见 [https://github.com/ericf/express-handlebars](https://github.com/ericf/express-handlebars)。

我们以修改主页为例，学习如何使用 Handlebars 。为了测试修改后能否正常显示文章及其相关信息，在开始之前，我们先注册几个用户并发表几篇文章，然后进行一些互相转载、访问和留言等工作，而不是清空数据库。

然后打开 views 文件夹，删除 header.ejs 和 footer.ejs ，新建 layout.hbs ，添加如下代码：

    <!DOCTYPE html>
    <html>
    <head>
    <meta charset="UTF-8" />
    <title>Blog</title>
    <link rel="stylesheet" href="/stylesheets/style.css">
    </head>
    <body>

    <header>
    <h1>{{title}}</h1>
    </header>

    <nav>
    <span><a title="主页" href="/">home</a></span>
    <span><a title="存档" href="/archive">archive</a></span>
    <span><a title="标签" href="/tags">tags</a></span>
    <span><a title="友情链接" href="/links">links</a></span>
    {{#if user}}
      <span><a title="上传" href="/upload">upload</a></span>
      <span><a title="发表" href="/post">post</a></span>
      <span><a title="登出" href="/logout">logout</a></span>
    {{else}}
      <span><a title="登录" href="/login">login</a></span>
      <span><a title="注册" href="/reg">register</a></span>
    {{/if}}
    <span><form action="/search" method="GET"><input type="text" name="keyword" placeholder="SEARCH" class="search" /></form></span>
    </nav>

    <article>

    {{#if success}}
      <div>{{success}}</div>
    {{/if}}
    {{#if error}}
      <div>{{error}}</div>
    {{/if}}

    {{{body}}}

    </article>
    </body>
    </html>

这里我们定义了一个默认的页面布局模版（layout.hbs）。其余所有的模版都将 "继承" 该模版，即替换掉 `{{{body}}}` 部分。

删除 index.ejs ，新建 index.hbs ，添加如下代码：

    {{#each posts}}
      <p><h2><a href="/u/{{name}}/{{time.day}}/{{title}}">{{title}}</a></h2>
      <a href="/u/{{name}}"><img src="{{head}}" class="r_head" /></a></p>
      <p class="info">
        作者：<a href="/u/{{name}}">{{name}}</a> | 
        日期：{{time.minute}} | 
        标签：
        {{#each tags}}
          {{#if this}}
            <a class="tag" href="/tags/{{this}}">{{this}}</a>
          {{/if}}
        {{/each}}
        {{#if reprint_info.reprint_from}}
          <br><a href="/u/{{reprint_info.reprint_from.name}}/{{reprint_info.reprint_from.day}}/{{reprint_info.reprint_from.title}}">原文链接</a>
        {{/if}}
      </p>
      <p>{{{post}}}</p>
      <p class="info">
        阅读：{{pv}} | 
        评论：{{comments.length}} | 
        转载：
        {{#if reprint_info.reprint_to}}
          {{reprint_info.reprint_to.length}}
        {{else}}
          0
        {{/if}}
      </p>
    {{/each}}

这样就可以了，现在运行你的博客试试吧。

当我们渲染 index.hbs （`res.render('index', { ... });`）时，index.hbs 会替换 layout.hbs 中的 `{{{body}}}` 部分，然后渲染视图。需要注意的是，我们在 `{{#each}} ... {{/each}}` 中使用了 `this` ，这里的 `this` 指向当前上下文，即代表遍历的每一项。

**注意**：Handlebars 中的 `{{{htmlContext}}}`，相当于 EJS 中的 `<%- htmlContext %>` ，`{{textContext}}` 相当于 `<%= textContext %>` 。

在 ejs 中，我们可以随意使用 JavaScript 表达式，如 `<% if (1 + 1 === 2) { %> ... <% } %>` ，但在 Handlebars 中我们却不能这样写 `{{#if (1 + 1 === 2)}} ... {{/if}}` ，那么该如何修改 archive.ejs 呢？archive.ejs 代码如下：

    <%- include header %>
    <ul class="archive">
    <% var lastYear = 0 %>
    <% posts.forEach(function (post, index) { %>
      <% if (lastYear != post.time.year) { %>
        <li><h3><%= post.time.year %></h3></li>
      <% lastYear = post.time.year } %>
        <li><time><%= post.time.day %></time></li>
        <li><a href="/u/<%= post.name %>/<%= post.time.day %>/<%= post.title %>"><%= post.title %></a></li>
    <% }) %>
    </ul>
    <%- include footer %>

我们通过定义了一个 lastYear 变量实现了判断并只显示一次年份的功能。在 Handlebars 中，我们可以通过 registerHelper 实现以上功能，关于 registerHelper 的使用详见 [http://handlebarsjs.com/block_helpers.html](http://handlebarsjs.com/block_helpers.html)。在 express-handlebars 中使用 registerHelper 也很简单，具体如下。

打开 index.js ，将 `app.get('/archive')` 修改如下：

    app.get('/archive', function (req, res) {
      Post.getArchive(function (err, posts) {
        if (err) {
          req.flash('error', err); 
          return res.redirect('/');
        }
        res.render('archive', {
          title: '存档',
          posts: posts,
          user: req.session.user,
          success: req.flash('success').toString(),
          error: req.flash('error').toString(),
          helpers: {
            showYear: function(index, options) {
              if ((index == 0) || (posts[index].time.year != posts[index - 1].time.year)) {
                return options.fn(this);
              }
            }
          }
        });
      });
    });

删除 archive.ejs ，新建 archive.hbs ，添加如下代码：

    <ul class="archive">
    {{#each posts}}
      {{#showYear @index}}
        <li><h3>{{this.time.year}}</h3></li>
      {{/showYear}}
      <li><time>{{this.time.day}}</time></li>
      <li><a href="/u/{{this.post.name}}/{{this.time.day}}/{{this.title}}">{{this.title}}</a></li>
    {{/each}}
    </ul>

假如你了解如何使用 Handlebars 中的 registerHelper ，那么上面的代码就很容易理解了。其中，`{{#each}} ... {{/each}}` 内的 @index 表示当前遍历的索引。

最后，还需提醒的一点是：我们每次渲染一个视图文件时，都会结合 layout.hbs 然后渲染，有时候我们并不需要 layout.hbs ，比如 404 页面，需设置为：

    res.render('404', {
      layout: false
    });

通过设置 `layout: false` 就取消了自动加载 layout.hbs 页面布局模版。

至此，我们通过采用 layout 的方式实现了视图文件的加载及渲染，express-handlebars 还提供了另一种类似于 EJS 中 include 的加载方式——使用 partial ，前面的修改中我们并没有添加分页模版（paging.hbs），要想引入分页模版使用 `{{> paging}}` 即可。详细使用见 [https://github.com/ericf/express-handlebars](https://github.com/ericf/express-handlebars)。

读者可自行完成剩余的修改工作。