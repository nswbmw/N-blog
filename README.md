N-blog
======

使用 Express + MongoDB 搭建多人博客  

教程见 [wiki](https://github.com/nswbmw/N-blog/wiki/_pages)
ˊ
###如何執行
1. `npm instll`
2. `安裝mongoDB ` 
3. `在mongo資料夾內的bin的同層目錄建造一個blog資料夾`
4. 使用系統管理員開啟cmd後`cd到mongo的資料夾裡的bin內`輸入`mongod --dbpath ../blog`
5. cd到clone的資料夾內輸入`node app`
6. 開啟瀏覽器`localhost:3000`


### 分支说明

- master: express4.x 版，受限于排版原因尽量做了最少的改动从原来的express3.x升到express4.x
- express4.x: express4.x 版，代码进行了重构
- koa: koa 版
- master-express3.x-backup: express3.x 版，备份
