前面我们搭建的博客使用了 Markdown 来写文章，假如普通用户使用的话不懂什么是 Markdown ，加之 Markdown 的表现力还并不是很丰富。这个时候，我们就需要一款强大的编辑器了，我们不妨试试 KindEditor。

### 什么是 KindEditor ###

KindEditor 是一套开源的在线 HTML 编辑器，主要用于让用户在网站上获得所见即所得编辑效果，开发人员可以用 KindEditor 把传统的多行文本输入框（textarea）替换为可视化的富文本输入框。KindEditor 使用 JavaScript 编写，可以无缝地与 Java、.NET、PHP、ASP 等程序集成，比较适合在 CMS、商城、论坛、博客、Wiki、电子邮件等互联网应用上使用。

**主要特点**

- 快速：体积小，加载速度快 
- 开源：开放源代码，高水平，高品质 
- 底层：内置自定义 DOM 类库，精确操作 DOM 
- 扩展：基于插件的设计，所有功能都是插件，可根据需求增减功能 
- 风格：修改编辑器风格非常容易，只需修改一个 CSS 文件 
- 兼容：支持大部分主流浏览器，比如 IE、Firefox、Safari、Chrome、Opera 

### 使用 KindEditor ###

到官网 [http://www.kindsoft.net/](http://www.kindsoft.net/) 下载最新的 KindEditor 压缩包，解压后将文件夹重命名为 kindEditor 并放到 public 文件夹下。

**注意**：可以根据自己需求删除文件夹或文件，我们删除以下文件夹：

- asp - ASP程序
- asp.net - ASP.NET程序
- php - PHP程序
- jsp - JSP程序
- examples - 演示文件

首先，我们来将多行文本输入框（textarea）替换为 kindEditor 编辑器。打开 header.ejs ，在：

    <link rel="stylesheet" href="/stylesheets/style.css">

下一行添加如下代码：

    <script charset="utf-8" src="/KindEditor/kindeditor-min.js"></script>
    <script charset="utf-8" src="/KindEditor/lang/zh_CN.js"></script>
    <script>
    var editor;
    KindEditor.ready(function(K) {
      editor = K.create('textarea', {
      allowImageUpload : false,
      items : [
        'fontname', 'fontsize', '|', 'forecolor', 'hilitecolor', 'bold', 'italic',
        'underline', 'removeformat', '|', 'justifyleft', 'justifycenter', 'justifyright',
        'insertorderedlist', 'insertunorderedlist', '|', 'emoticons', 'image', 'link']
      });
    });
    </script>

**注意**：这里我们通过 create 创建了一个编辑器，第一个参数为 CSS 选择器，设置为 textarea ，则发表、编辑及留言的 textarea 都会变为编辑器。假如我们只想让发表和编辑时使用编辑器，留言时不使用编辑器，则只需将 `textarea` 修改为 `textarea[name="post"]` 即可。第二个参数可以设置编辑器的编辑选项，这里我们通过自定义 items 配置编辑器的工具栏，其中可用 "/" 表示换行，"|" 表示分隔符。，并设置 `allowImageUpload : false` 取消编辑器的图片上传按钮。详细的编辑器配置请查阅 [http://www.kindsoft.net/docs/option.html](http://www.kindsoft.net/docs/option.html)。

以上是简单的（simple）编辑器样式，我们也可以使用 KindEditor 默认的（default）编辑器样式，将以上 `KindEditor.ready` 替换为以下代码即可(这里我们不做修改)：

    var editor;
    KindEditor.ready(function(K) {
      editor = K.create('#kindeditor');
    });

最后，删除有关转换 Markdown 的代码。打开 post.js ，删除：

    markdown = require('markdown').markdown

删除 `Post.getTen` 内的：

    docs.forEach(function (doc) {
      doc.post = markdown.toHTML(doc.post);
    }); 

删除 `Post.getOne` 内的：

    doc.post = markdown.toHTML(doc.post);
    doc.comments.forEach(function (comment) {
      comment.content = markdown.toHTML(comment.content);
    });

现在，运行你的博客试试吧。

**发表前**

![](https://github.com/nswbmw/N-blog/blob/master/public/images/22.1.jpg?raw=true)

**发表后**

![](https://github.com/nswbmw/N-blog/blob/master/public/images/22.2.jpg?raw=true)

**注意**：添加图片地址时，引用站外的图片要用绝对地址，引用站内的图片则用相对地址，如：/images/lufei.jpg 。

更多关于 KindEditor 的使用详见官方文档。

### 参考文献 ###

- KindEditor ： [http://www.kindsoft.net/](http://www.kindsoft.net/)
- 可视化HTML编辑器 KindEditor ： [http://www.oschina.net/p/kindeditor/](http://www.oschina.net/p/kindeditor/)