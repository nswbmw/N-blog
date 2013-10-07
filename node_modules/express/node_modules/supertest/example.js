
var request = require('./')
  , express = require('express');

var app = express();

app.get('/user', function(req, res){
  res.send(201, { name: 'tobi' });
});

request(app)
  .get('/user')
  .expect('Content-Type', /json/)
  .expect('Content-Length', '20')
  .expect(201)
  .end(function(err, res){
    if (err) throw err;
    console.log('done');
    process.exit();
  });
