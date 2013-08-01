N-blog
======

使用 Express + MongoDB 搭建多人博客  

教程见 [wiki](https://github.com/nswbmw/N-blog/wiki/_pages)

### bug修复日志：###

#### bug-fix-1（2013年5月24日） ####

1.打开 header.ejs ，将 `<style type="text/css">...</style>` 修改为：`<link rel="stylesheet" href="/stylesheets/style.css">`

2.把原先 `<style type="text/css">...</style>` 中的样式全部放到 `public/stylesheets/style.css` 中

3.打开 app.js ，将：

    app.use(app.router);
    app.use(express.static(path.join(__dirname, 'public')));
    
修改为：

    app.use(express.static(path.join(__dirname, 'public')));
    app.use(app.router);

#### bug-fix-2（2013年6月22日） ####

修复当发表文章数为10的倍数时，最后一页仍显示 “下一页” 的 bug 。

1.打开 post.js ，将 `Post.getTen` 修改成如下：

    Post.getTen = function(name, page, callback) {//一次获取十篇文章
      //打开数据库
      mongodb.open(function (err, db) {
        if (err) {
          return callback(err);
        }
        //读取 posts 集合
        db.collection('posts', function(err, collection) {
          if (err) {
            mongodb.close();
            return callback(err);
          }
          var query = {};
          if (name) {
            query.name = name;
          }
          //使用 count 返回总文档数 total
          collection.count(function(err, total){
            //根据 query 对象查询，并跳过前 (page-1)*10 个结果，返回之后的10个结果
            collection.find(query,{skip:(page-1)*10,limit:10}).sort({
              time: -1
            }).toArray(function (err, docs) {
              mongodb.close();
              if (err) {
                callback(err, null);//失败！返回 null
              }
              //解析 markdown 为 html
              docs.forEach(function(doc){
                doc.post = markdown.toHTML(doc.post);
              });  
              callback(null, docs, total);
            });
          });
        });
      });
    };

2.打开 index.js ，将 `app.get('/')` 修改成如下：

    app.get('/', function(req,res){
      //判断是否是第一页，并把请求的页数转换成 number 类型
      var page = req.query.p?parseInt(req.query.p):1;
      //查询并返回第 page 页的10篇文章
      Post.getTen(null, page, function(err, posts, total){
        if(err){
          posts = [];
        } 
        res.render('index',{
          title: '主页',
          user: req.session.user,
          posts: posts,
          page: page,
          isFirstPage: (page-1)==0,
          isLastPage: ((page-1)*10+posts.length)==total,
          success: req.flash('success').toString(),
          error: req.flash('error').toString()
        });
      });
    });

3.打开 inde.js ，将 `app.get('/u/:name')` 修改成如下：

    app.get('/u/:name', function(req,res){
      var page = req.query.p?parseInt(req.query.p):1;
      //检查用户是否存在
      User.get(req.params.name, function(err, user){
        if(!user){
          req.flash('error','用户不存在!'); 
          return res.redirect('/');
        }
        //查询并返回该用户第 page 页的10篇文章
        Post.getTen(user.name, page, function(err, posts, total){
          if(err){
            req.flash('error',err); 
            return res.redirect('/');
          } 
          res.render('user',{
            title: user.name,
            posts: posts,
            page: page,
            isFirstPage: (page-1)==0,
            isLastPage: ((page-1)*10+posts.length)==total,
            user : req.session.user,
            success : req.flash('success').toString(),
            error : req.flash('error').toString()
          });
        });
      }); 
    });

4.打开 paging.ejs ，修改成如下：

    <br />
    <div>
      <% if(!isFirstPage){ %>
        <span class="prepage"><a title="上一页" href="?p=<%= page-1 %>">上一页</a></span>
      <% } %>

      <% if(!isLastPage){ %>
        <span class="nextpage"><a title="下一页" href="?p=<%= page+1 %>">下一页</a></span>
      <% } %>
    </div>

5.打开 style.css ，将 `.lastpage` 修改为 `.prepage`。
