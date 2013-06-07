N-blog
======

使用 Express + MongoDB 搭建多人博客  

教程见 [wiki](https://github.com/nswbmw/N-blog/wiki/_pages)

### bug修复日志：###

#### （2013年5月24日）bug-fix-1: ####

1.打开 header.ejs ，将 `<style type="text/css">...</style>` 修改为：`<link rel="stylesheet" href="/stylesheets/style.css">`

2.把原先 `<style type="text/css">...</style>` 中的样式全部放到 `public/stylesheets/style.css` 中

3.打开 app.js ，将：

    app.use(app.router);
    app.use(express.static(path.join(__dirname, 'public')));
    
修改为：

    app.use(express.static(path.join(__dirname, 'public')));
    app.use(app.router);
