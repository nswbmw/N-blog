var gravatar = require('gravatar');
var moment = require('moment');

var User = require('../models/user');
var Post = require('../models/post');
var exception = require('../lib/exception');
var md5 = require('../lib/md5');

function checkLogin(req, res, next) {
  if (!req.session.user) {
    req.flash('info', '未登录!');
    return res.redirect('/login');
  }
  next();
}

function checkNotLogin(req, res, next) {
  if (req.session.user) {
    req.flash('info', '已登录!');
    return res.redirect('back');
  }
  next();
}

module.exports = function (app) {
  app.get('/', function (req, res, next) {
    var page = req.query.p ? parseInt(req.query.p, 10) : 1;
    Post.getTen(null, page, function (err, posts) {
      if (err) {
        return next(err);
      }
      Post.count(function (err, total) {
        if (err) {
          return next(err);
        }
        res.render('index', {
          title: '主页',
          posts: posts,
          page: page,
          user: req.session.user,
          isFirstPage: (page - 1) === 0,
          isLastPage: ((page - 1) * 10 + posts.length) === total,
          flash: req.flash('info').toString()
        });
      });
    });
  });

  app.get('/reg', checkNotLogin);
  app.get('/reg', function (req, res, next) {
    res.render('reg', {
      title: '注册',
      user: req.session.user,
      flash: req.flash('info').toString()
    });
  });

  app.post('/reg', checkNotLogin);
  app.post('/reg', function (req, res, next) {
    var body = req.body;
    var name = body.name;
    var password = body.password;
    var password_re = body['password-repeat'];
    var email = body.email;

    if (password_re !== password) {
      req.flash('info', '两次输入的密码不一致!');
      return res.redirect('/reg');
    }

    User.get(name, function (err, user) {
      if (err) {
        return next(err);
      }
      if (user) {
        req.flash('info', '用户已存在!');
        return res.redirect('/reg');
      }

      var newUser = {
          name: name,
          password: md5(password),
          email: email,
          avatar: gravatar.url(email, {s: 48})
      };

      User.save(newUser, function (err) {
        if (err) {
          return next(err);
        }
        delete newUser.password;
        req.session.user = newUser;
        req.flash('info', '注册成功!');
        res.redirect('/');
      });
    });
  });

  app.get('/login', checkNotLogin);
  app.get('/login', function (req, res, next) {
    res.render('login', {
      title: '登录',
      user: req.session.user,
      flash: req.flash('info').toString()
    });
  });

  app.post('/login', checkNotLogin);
  app.post('/login', function (req, res, next) {
    var name = req.body.name;
    var password = req.body.password;

    User.get(name, function (err, user) {
      if (err) {
        return next(err);
      }

      if (!user) {
        req.flash('info', '用户不存在!');
        return res.redirect('/login');
      }

      if (user.password !== md5(password)) {
        req.flash('info', '密码错误!');
        return res.redirect('/login');
      }

      delete user.password;
      req.session.user = user;
      req.flash('info', '登录成功!');
      res.redirect('/');
    });
  });

  app.get('/post', checkLogin);
  app.get('/post', function (req, res, next) {
    res.render('post', {
      title: '发表',
      user: req.session.user,
      flash: req.flash('info').toString()
    });
  });

  app.post('/post', checkLogin);
  app.post('/post', function (req, res, next) {
    Post.save(req.session.user, req.body, function (err) {
      if (err) {
        return next(err);
      }
      req.flash('info', '发布成功!');
      res.redirect('/');
    });
  });

  app.get('/logout', checkLogin);
  app.get('/logout', function (req, res, next) {
    req.session.user = null;
    req.flash('info', '登出成功!');
    res.redirect('/');
  });

  app.get('/archive', function (req, res, next) {
    Post.getArchive(function (err, posts) {
      if (err) {
        return next(err);
      }
      res.render('archive', {
        title: '存档',
        posts: posts,
        user: req.session.user,
        flash: req.flash('info').toString()
      });
    });
  });

  app.get('/tags', function (req, res, next) {
    Post.getTags(function (err, posts) {
      if (err) {
        return next(err);
      }
      res.render('tags', {
        title: '标签',
        posts: posts,
        user: req.session.user,
        flash: req.flash('info').toString()
      });
    });
  });

  app.get('/tags/:tag', function (req, res, next) {
    var tag = req.params.tag;
    Post.getTag(tag, function (err, posts) {
      if (err) {
        return next(err);
      }
      res.render('tag', {
        title: 'TAG:' + tag,
        posts: posts,
        user: req.session.user,
        flash: req.flash('info').toString()
      });
    });
  });

  app.get('/links', function (req, res) {
    res.render('links', {
      title: '友情链接',
      user: req.session.user,
      flash: req.flash('info').toString()
    });
  });

  app.get('/search', function (req, res, next) {
    var keyword = req.query.keyword;
    Post.search(req.query.keyword, function (err, posts) {
      if (err) {
        return next(err);
      }
      res.render('search', {
        title: "SEARCH:" + keyword,
        posts: posts,
        user: req.session.user,
        flash: req.flash('info').toString()
      });
    });
  });

  app.get('/u/:name', function (req, res, next) {
    var page = req.query.p ? parseInt(req.query.p, 10) : 1;
    var name = req.params.name;

    Post.getTen(name, page, function (err, posts) {
      if (err) {
        return next(err);
      }
      Post.count(name, function (err, total) {
        if (err) {
          return next(err);
        }
        res.render('user', {
          title: name,
          posts: posts,
          page: page,
          isFirstPage: (page - 1) === 0,
          isLastPage: ((page - 1) * 10 + posts.length) === total,
          user: req.session.user,
          flash: req.flash('info').toString()
        });
      });
    });
  });

  app.get('/p/:id', function (req, res, next) {
    var id = req.params.id;
    Post.getOne(id, function (err, post) {
      if (err) {
        return next(err);
      }
      res.render('article', {
        title: post.title,
        post: post,
        user: req.session.user,
        flash: req.flash('info').toString()
      });
    });
  });

  app.post('/p/:id', checkLogin);
  app.post('/p/:id', function (req, res, next) {
    var body = req.body;
    var id = req.params.id;

    var newComment = {
      name: body.name,
      avatar: gravatar.url(body.email, {s: 48}),
      email: body.email,
      website: body.website,
      time: Date.now(),
      content: body.content
    };

    Post.postOne(id, newComment, function (err) {
      if (err) {
        return next(err);
      }
      req.flash('info', '留言成功!');
      res.redirect('back');
    });
  });

  app.get('/edit/:id/', checkLogin);
  app.get('/edit/:id/', function (req, res, next) {
    var currentUser = req.session.user;
    var id = req.params.id;

    Post.getEdit(id, currentUser.name, function (err, post) {
      if (err) {
        return next(err);
      }
      res.render('edit', {
        title: '编辑',
        post: post,
        user: req.session.user,
        flash: req.flash('info').toString()
      });
    });
  });

  app.post('/edit/:id', checkLogin);
  app.post('/edit/:id', function (req, res, next) {
    var currentUser = req.session.user;
    var id = req.params.id;
    Post.postEdit(id, currentUser.name, req.body, function (err) {
      if (err) {
        return next(err);
      }
      req.flash('info', '修改成功!');
      res.redirect('/p/' + id);
    });
  });

  app.get('/delete/:id', checkLogin);
  app.get('/delete/:id', function (req, res, next) {
    var currentUser = req.session.user;
    var id = req.params.id;

    Post.getDelete(id, currentUser.name, function (err) {
      if (err) {
        return next(err);
      }
      req.flash('info', '删除成功!');
      res.redirect('/');
    });
  });

  app.get('/reprint/:id', checkLogin);
  app.get('/reprint/:id', function (req, res, next) {
    var currentUser = req.session.user;
    var id = req.params.id;

    Post.getReprint(id, currentUser, function (err) {
      if (err) {
        return next(err);
      }
      req.flash('info', '转载成功!');
      res.redirect('/');
    });
  });

  app.use(function (req, res, next) {
    next({
      code: 'NotFound',
      message: 'NotFound ' + req.path
    });
  });
    
  app.use(function(err, req, res, next) {
    if (err.code == 'NotFound') {
      res.render('404');
    } else {
      res.render('error', { error: err });
    }
  });
};