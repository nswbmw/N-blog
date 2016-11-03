现在我们来给博客添加支持 markdown 发表文章的功能。  
假如你不还熟悉 markdown，请转到：[http://wowubuntu.com/markdown/](http://wowubuntu.com/markdown/)

打开 package.json ，添加一行代码：

    "markdown": "0.5.0"

使用 `npm install` 安装 markdown 模块。

打开 post.js，在 `mongodb = require('./db')` 后添加一行代码：

    markdown = require('markdown').markdown;

在 `Post.get` 函数里的 `callback(null, docs);` 前添加以下代码：

    //解析 markdown 为 html
    docs.forEach(function (doc) {
      doc.post = markdown.toHTML(doc.post);
    });

现在我们就可以使用 markdown 发表文章了。

**注意**：每当我们给博客添加新功能后，都要清空数据库（即删除 mongodb/blog 文件夹里所有文件）再启动我们的博客。以后每一章都是如此，后面便不再赘述。

运行我们的博客，如图所示：

**发表前**

![](https://github.com/nswbmw/N-blog/blob/master/public/images/2.1.jpg?raw=true)

**发表后**

![](https://github.com/nswbmw/N-blog/blob/master/public/images/2.2.jpg?raw=true)