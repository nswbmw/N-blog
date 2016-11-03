### Cannot read property 'post' of null

问题原因：可能是没有清空数据库。每进行一章都会添加新的功能，有可能会改变数据的结构（比如添加了新的字段），而之前存在数据库中的文档的结构是老的，这个时候想要通过新添加的字段去查询数据库，老文档将会返回null。

解决方法：每开始新一章的学习前，首先清空数据库。

### 发表文章后，数据库中存在该文章，却打不开该文章页

问题原因：可能是标题末尾带有空格，这样在请求URL时末尾空格会被忽略掉，导致到数据库中查询的时候少了一个空格所以查不到。

解决方法：存储文章标题的时候使用.trim()方法。

### throw new TypeError('app.use() requires middleware functions');

Multer 版本问题，见 [issue 111](https://github.com/nswbmw/N-blog/issues/111#issuecomment-168147825)

### Failed to load c++ bson extension, using pure JS version

C++ 版的 bson 库编译失败用不了，降级到使用原生 js 的 bson 库。只是个 warning，可以无视。