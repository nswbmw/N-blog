var express = require('express');
var http = require('http');

var app = express();

var n = 50;

while (n--) {
  app.use(function(req, res, next){
    next();
  });
}

http.createServer(app).listen(3000);
