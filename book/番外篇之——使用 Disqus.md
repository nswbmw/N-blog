前面我们搭建的博客使用了自建的留言系统，支持 Markdown ，并且将留言存到了数据库中。现在我们来使用 Disqus 代替原来的留言系统。

### 什么是 Disqus？ ###

Disqus 是一个第三方社会化评论系统，主要为网站主提供评论托管服务。CNN、NBC、Fox News、Engadget、Time 等知名网站均使用了 Disqus 提供的社会化评论系统。WordPress、Blogger、Tumblr 等第三方博客平台均提供了 Disqus 第三方评论插件。目前，第三方社会化评论系统在美国，基本是主流网站的标配。

Disqus 的主要目标是通过提供功能强大的第三评论系统，将当前不同网站的相对孤立、隔绝的评论系统，连接成具有社会化特性的大网。通过 Disqus 评论系统所具备的评论回复通知、评论分享和热文分享等社会化功能，网站主可以有效的提高网站用户的活跃度和流量。用户使用 Disqus，在不同网站上评论，无需重复注册账号，只需使用 Disqus 账号或者第三方平台账号，即可方便的进行评论，且所有评论都会存储、保存在 Disqus 账号后台，方便随时查看、回顾。而且，当有用户回复自己的评论时，可以选择使用邮箱接收相关信息，保证所有评论的后续行为都可以随时掌握。与此同时，Disqus 将社交交友功能也很好的融入到了评论系统中，当用户在某一网站上看到有与自己类似观点的评论时，可对该评论的评论者进行关注，关注后，该评论者以后的所有评论都会显示在自己的账号后台。

### 为什么使用 Disqus？ ###

- 相比较使用自建的留言系统，使用 Disqus 有以下几点优势：
- 支持评论嵌套
- 支持使用 Disqus 或第三方账号评论
- 简单安全。不用存储到自己的数据库，安全性也得到提高
- 方便并且强大的评论管理功能
- 集成良好，自适应，简洁优美
- 等等

### 注册 Disqus ###

[https://disqus.com/profile/signup/](https://disqus.com/profile/signup/)

### 使用 Disqus ###

使用 Disqus 非常简单！

第一步：登陆后进入到 http://disqus.com/dashboard/ 页面，点击左侧的 +add 按钮创建一个站点，填写好信息后点击 Finish registration 完成创建。

第二步：此时进入到了 Choose your platform 页面。这里根据我们的实际情况点击第一个 Universal Code 按钮。

第三步：此时进入到了 Disqus 安装说明页。这里有详细的说明步骤，我们这里只需复制第一个代码块中的代码。然后打开 comment.ejs ，删除所有代码并粘贴刚才复制的代码，保存即可。

现在运行我们的博客，发表篇文章试试吧，如下图所示：

![](https://raw.github.com/nswbmw/N-blog/master/public/images/24.1.jpg)

读者可自行删除有关存储评论的代码，这里不再赘述。

### 参考文献 ###

Disqus 百度百科 ： [http://baike.baidu.com/view/5941866.htm](http://baike.baidu.com/view/5941866.htm)