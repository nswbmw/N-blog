## N-blog

使用 Express + MongoDB 搭建多人博客

## 开发环境

- Node.js: `6.9.1`
- MongoDB: `3.2.10`
- Express: `4.14.0`

## 目录

- 开发环境搭建
    - [Node.js 的安装与使用](https://github.com/nswbmw/N-blog/blob/master/book/1.1%20Node.js%20%E7%9A%84%E5%AE%89%E8%A3%85%E4%B8%8E%E4%BD%BF%E7%94%A8.md)
        - [安装 Node.js](https://github.com/nswbmw/N-blog/blob/master/book/1.1%20Node.js%20%E7%9A%84%E5%AE%89%E8%A3%85%E4%B8%8E%E4%BD%BF%E7%94%A8.md#111-安装-nodejs)
        - [n 和 nvm](https://github.com/nswbmw/N-blog/blob/master/book/1.1%20Node.js%20%E7%9A%84%E5%AE%89%E8%A3%85%E4%B8%8E%E4%BD%BF%E7%94%A8.md#112-n-和-nvm)
        - [nrm](https://github.com/nswbmw/N-blog/blob/master/book/1.1%20Node.js%20%E7%9A%84%E5%AE%89%E8%A3%85%E4%B8%8E%E4%BD%BF%E7%94%A8.md#113-nrm)
    - [MongoDB 的安装与使用](https://github.com/nswbmw/N-blog/blob/master/book/1.2%20MongoDB%20%E7%9A%84%E5%AE%89%E8%A3%85%E4%B8%8E%E4%BD%BF%E7%94%A8.md)
        - [安装与启动 MongoDB](https://github.com/nswbmw/N-blog/blob/master/book/1.2%20MongoDB%20%E7%9A%84%E5%AE%89%E8%A3%85%E4%B8%8E%E4%BD%BF%E7%94%A8.md#121-安装与启动-mongodb)
        - [Robomongo 和 MongoChef](https://github.com/nswbmw/N-blog/blob/master/book/1.2%20MongoDB%20%E7%9A%84%E5%AE%89%E8%A3%85%E4%B8%8E%E4%BD%BF%E7%94%A8.md#122-robomongo-和-mongochef)
- Node.js 知识点讲解
    - [require](https://github.com/nswbmw/N-blog/blob/master/book/2.1%20require.md)
    - [exports 和 module.exports](https://github.com/nswbmw/N-blog/blob/master/book/2.2%20exports%20%E5%92%8C%20module.exports.md)
    - [Promise](https://github.com/nswbmw/N-blog/blob/master/book/2.3%20Promise.md)
    - [环境变量](https://github.com/nswbmw/N-blog/blob/master/book/2.4%20%E7%8E%AF%E5%A2%83%E5%8F%98%E9%87%8F.md)
    - [packge.json](https://github.com/nswbmw/N-blog/blob/master/book/2.5%20package.json.md)
        - [semver](https://github.com/nswbmw/N-blog/blob/master/book/2.5%20package.json.md#251-semver)
    - [npm 使用注意事项](https://github.com/nswbmw/N-blog/blob/master/book/2.6%20npm%20%E4%BD%BF%E7%94%A8%E6%B3%A8%E6%84%8F%E4%BA%8B%E9%A1%B9.md)
        - [npm init](https://github.com/nswbmw/N-blog/blob/master/book/2.6%20npm%20%E4%BD%BF%E7%94%A8%E6%B3%A8%E6%84%8F%E4%BA%8B%E9%A1%B9.md#261-npm-init)
        - [npm install](https://github.com/nswbmw/N-blog/blob/master/book/2.6%20npm%20%E4%BD%BF%E7%94%A8%E6%B3%A8%E6%84%8F%E4%BA%8B%E9%A1%B9.md#262-npm-install)
        - [npm scripts](https://github.com/nswbmw/N-blog/blob/master/book/2.6%20npm%20%E4%BD%BF%E7%94%A8%E6%B3%A8%E6%84%8F%E4%BA%8B%E9%A1%B9.md#263-npm-scripts)
        - [npm shrinkwrap ](https://github.com/nswbmw/N-blog/blob/master/book/2.6%20npm%20%E4%BD%BF%E7%94%A8%E6%B3%A8%E6%84%8F%E4%BA%8B%E9%A1%B9.md#264-npm-shrinkwrap)
- Hello, Express
    - [初始化一个 Express 项目](https://github.com/nswbmw/N-blog/blob/master/book/3.1%20%E5%88%9D%E5%A7%8B%E5%8C%96%E4%B8%80%E4%B8%AA%20Express%20%E9%A1%B9%E7%9B%AE.md)
        - [supervisor](https://github.com/nswbmw/N-blog/blob/master/book/3.1%20%E5%88%9D%E5%A7%8B%E5%8C%96%E4%B8%80%E4%B8%AA%20Express%20%E9%A1%B9%E7%9B%AE.md#311-supervisor)
    - [路由](https://github.com/nswbmw/N-blog/blob/master/book/3.2%20%E8%B7%AF%E7%94%B1.md)
        - [express.Router](https://github.com/nswbmw/N-blog/blob/master/book/3.2%20%E8%B7%AF%E7%94%B1.md#321-expressrouter)
    - [模板引擎](https://github.com/nswbmw/N-blog/blob/master/book/3.3%20%E6%A8%A1%E6%9D%BF%E5%BC%95%E6%93%8E.md)
        - [ejs](https://github.com/nswbmw/N-blog/blob/master/book/3.3%20%E6%A8%A1%E6%9D%BF%E5%BC%95%E6%93%8E.md#331-ejs)
        - [includes](https://github.com/nswbmw/N-blog/blob/master/book/3.3%20%E6%A8%A1%E6%9D%BF%E5%BC%95%E6%93%8E.md#332-includes)
    - [Express 浅析](https://github.com/nswbmw/N-blog/blob/master/book/3.4%20Express%20%E6%B5%85%E6%9E%90.md)
        - [中间件与 next](https://github.com/nswbmw/N-blog/blob/master/book/3.4%20Express%20%E6%B5%85%E6%9E%90.md#341-中间件与-next)
        - [错误处理](https://github.com/nswbmw/N-blog/blob/master/book/3.4%20Express%20%E6%B5%85%E6%9E%90.md#342-错误处理)
- 一个简单的博客
    - [开发环境](https://github.com/nswbmw/N-blog/blob/master/book/4.1%20%E5%BC%80%E5%8F%91%E7%8E%AF%E5%A2%83.md)
    - [准备工作](https://github.com/nswbmw/N-blog/blob/master/book/4.2%20%E5%87%86%E5%A4%87%E5%B7%A5%E4%BD%9C.md)
        - [目录结构](https://github.com/nswbmw/N-blog/blob/master/book/4.2%20%E5%87%86%E5%A4%87%E5%B7%A5%E4%BD%9C.md#421-目录结构)
        - [安装依赖模块](https://github.com/nswbmw/N-blog/blob/master/book/4.2%20%E5%87%86%E5%A4%87%E5%B7%A5%E4%BD%9C.md#422-安装依赖模块)
    - [配置文件](https://github.com/nswbmw/N-blog/blob/master/book/4.3%20%E9%85%8D%E7%BD%AE%E6%96%87%E4%BB%B6.md)
        - [config-lite](https://github.com/nswbmw/N-blog/blob/master/book/4.3%20%E9%85%8D%E7%BD%AE%E6%96%87%E4%BB%B6.md#431-config-lite)
    - [功能设计](https://github.com/nswbmw/N-blog/blob/master/book/4.4%20%E5%8A%9F%E8%83%BD%E8%AE%BE%E8%AE%A1.md)
        - [功能与路由设计](https://github.com/nswbmw/N-blog/blob/master/book/4.4%20%E5%8A%9F%E8%83%BD%E8%AE%BE%E8%AE%A1.md#441-功能与路由设计)
        - [会话](https://github.com/nswbmw/N-blog/blob/master/book/4.4%20%E5%8A%9F%E8%83%BD%E8%AE%BE%E8%AE%A1.md#442-会话)
        - [页面通知](https://github.com/nswbmw/N-blog/blob/master/book/4.4%20%E5%8A%9F%E8%83%BD%E8%AE%BE%E8%AE%A1.md#443-页面通知)
        - [权限控制](https://github.com/nswbmw/N-blog/blob/master/book/4.4%20%E5%8A%9F%E8%83%BD%E8%AE%BE%E8%AE%A1.md#444-权限控制)
    - [页面设计](https://github.com/nswbmw/N-blog/blob/master/book/4.5%20%E9%A1%B5%E9%9D%A2%E8%AE%BE%E8%AE%A1.md)
        - [组件](https://github.com/nswbmw/N-blog/blob/master/book/4.5%20%E9%A1%B5%E9%9D%A2%E8%AE%BE%E8%AE%A1.md#451-组件)
        - [app.locals 和 res.locals](https://github.com/nswbmw/N-blog/blob/master/book/4.5%20%E9%A1%B5%E9%9D%A2%E8%AE%BE%E8%AE%A1.md#452-applocals-和-reslocals)
    - [连接数据库](https://github.com/nswbmw/N-blog/blob/master/book/4.6%20%E8%BF%9E%E6%8E%A5%E6%95%B0%E6%8D%AE%E5%BA%93.md)
        - [为什么使用 Mongolass](https://github.com/nswbmw/N-blog/blob/master/book/4.6%20%E8%BF%9E%E6%8E%A5%E6%95%B0%E6%8D%AE%E5%BA%93.md#461-为什么使用-mongolass)
    - [注册](https://github.com/nswbmw/N-blog/blob/master/book/4.7%20%E6%B3%A8%E5%86%8C.md)
        - [用户模型设计](https://github.com/nswbmw/N-blog/blob/master/book/4.7%20%E6%B3%A8%E5%86%8C.md#471-用户模型设计)
        - [注册页](https://github.com/nswbmw/N-blog/blob/master/book/4.7%20%E6%B3%A8%E5%86%8C.md#472-注册页)
        - [注册与文件上传](https://github.com/nswbmw/N-blog/blob/master/book/4.7%20%E6%B3%A8%E5%86%8C.md#473-注册与文件上传)
    - [登出与登录](https://github.com/nswbmw/N-blog/blob/master/book/4.8%20%E7%99%BB%E5%87%BA%E4%B8%8E%E7%99%BB%E5%BD%95.md)
        - [登出](https://github.com/nswbmw/N-blog/blob/master/book/4.8%20%E7%99%BB%E5%87%BA%E4%B8%8E%E7%99%BB%E5%BD%95.md#481-登出)
        - [登录页](https://github.com/nswbmw/N-blog/blob/master/book/4.8%20%E7%99%BB%E5%87%BA%E4%B8%8E%E7%99%BB%E5%BD%95.md#482-登录页)
        - [登录](https://github.com/nswbmw/N-blog/blob/master/book/4.8%20%E7%99%BB%E5%87%BA%E4%B8%8E%E7%99%BB%E5%BD%95.md#483-登录)
    - [文章](https://github.com/nswbmw/N-blog/blob/master/book/4.9%20%E6%96%87%E7%AB%A0.md)
        - [文章模型设计](https://github.com/nswbmw/N-blog/blob/master/book/4.9%20%E6%96%87%E7%AB%A0.md#491-文章模型设计)
        - [发表文章](https://github.com/nswbmw/N-blog/blob/master/book/4.9%20%E6%96%87%E7%AB%A0.md#492-发表文章)
        - [主页与文章页](https://github.com/nswbmw/N-blog/blob/master/book/4.9%20%E6%96%87%E7%AB%A0.md#493-主页与文章页)
        - [编辑与删除文章](https://github.com/nswbmw/N-blog/blob/master/book/4.9%20%E6%96%87%E7%AB%A0.md#494-编辑与删除文章)
    - [留言](https://github.com/nswbmw/N-blog/blob/master/book/4.10%20%E7%95%99%E8%A8%80.md)
        - [留言模型设计](https://github.com/nswbmw/N-blog/blob/master/book/4.10%20%E7%95%99%E8%A8%80.md#4101-留言模型设计)
        - [显示留言](https://github.com/nswbmw/N-blog/blob/master/book/4.10%20%E7%95%99%E8%A8%80.md#4102-显示留言)
        - [发表与删除留言](https://github.com/nswbmw/N-blog/blob/master/book/4.10%20%E7%95%99%E8%A8%80.md#4103-发表与删除留言)
    - [404页面](https://github.com/nswbmw/N-blog/blob/master/book/4.11%20404%20%E9%A1%B5%E9%9D%A2.md)
    - [错误页面](https://github.com/nswbmw/N-blog/blob/master/book/4.12%20%E9%94%99%E8%AF%AF%E9%A1%B5%E9%9D%A2.md)
    - [日志](https://github.com/nswbmw/N-blog/blob/master/book/4.13%20%E6%97%A5%E5%BF%97.md)
        - [winston 和 express-winston](https://github.com/nswbmw/N-blog/blob/master/book/4.13%20%E6%97%A5%E5%BF%97.md#4131-winston-和-express-winston)
        - [.gitignore](https://github.com/nswbmw/N-blog/blob/master/book/4.13%20%E6%97%A5%E5%BF%97.md#4132-gitignore)
    - [测试](https://github.com/nswbmw/N-blog/blob/master/book/4.14%20%E6%B5%8B%E8%AF%95.md)
        - [mocha 和 supertest](https://github.com/nswbmw/N-blog/blob/master/book/4.14%20%E6%B5%8B%E8%AF%95.md#4141-mocha-和-supertest)
        - [测试覆盖率](https://github.com/nswbmw/N-blog/blob/master/book/4.14%20%E6%B5%8B%E8%AF%95.md#4142-测试覆盖率)
    - [部署](https://github.com/nswbmw/N-blog/blob/master/book/4.15%20%E9%83%A8%E7%BD%B2.md)
        - [申请 MLab](https://github.com/nswbmw/N-blog/blob/master/book/4.15%20%E9%83%A8%E7%BD%B2.md#4151-申请-mlab)
        - [pm2](https://github.com/nswbmw/N-blog/blob/master/book/4.15%20%E9%83%A8%E7%BD%B2.md#4152-pm2)
        - [部署到 Heroku](https://github.com/nswbmw/N-blog/blob/master/book/4.15%20%E9%83%A8%E7%BD%B2.md#4152-部署到-heroku)
        - [部署到 UCloud](https://github.com/nswbmw/N-blog/blob/master/book/4.15%20%E9%83%A8%E7%BD%B2.md#4153-部署到-ucloud)

## GitBook

[GitBook 在线阅读](https://maninboat.gitbooks.io/n-blog/content/)

## 捐赠

您的捐赠，是我持续开源的动力。

支付宝 | 微信
------|------
![](./public/alipay.png) | ![](./public/wechat.jpeg)