var marked = require('marked');
var moment = require('moment');
var gravatar = require('gravatar');
var ObjectID = require('mongodb').ObjectID;

var exception = require('../lib/exception');
var mongoPool = require('../lib/mongoPool');

exports.save = function (user, data, cb) {
  var tags = {};
  data.tags.forEach(function (tag) {
    if (tag) {
      tags[tag.toLowerCase()] = 1;
    }
  });
  var doc = {
    name: user.name,
    avatar: user.avatar,
    time: Date.now(),
    title: data.title,
    tags: Object.keys(tags),
    content: data.content,
    comments: [],
    pv: 0
  };

  mongoPool.acquire(function (err, client) {
    if (err) {
      return cb(exception(exception.MongoPoolError, err.message));
    }
    client
      .db('blog')
      .collection('posts')
      .insert(doc, function (err, res) {
        if (err) {
          mongoPool.release(client);
          return cb(exception(exception.DBError, err.message));
        }
        mongoPool.release(client);
        cb(null, res);
      });
  });
};

exports.getTen = function (name, page, cb) {
  var query = {};
  if (name) {
    query.name = name;
  }
  mongoPool.acquire(function (err, client) {
    if (err) {
      return cb(exception(exception.MongoPoolError, err.message));
    }
    client
      .db('blog')
      .collection('posts')
      .find(query)
      .sort({time: -1})
      .skip((page - 1) * 10)
      .limit(10)
      .toArray(function (err, docs) {
        if (err) {
          mongoPool.release(client);
          return cb(exception(exception.DBError, err.message));
        }
        docs.forEach(function (doc) {
          doc.content = marked(doc.content);
          doc.time = moment(doc.time).format('YYYY-MM-DD HH:mm');
          doc.comments.forEach(function (comment) {
            comment.time = moment(comment.time).format('YYYY-MM-DD HH:mm');
          });
        });
        mongoPool.release(client);
        cb(null, docs);
      });
  });
};

exports.count = function (name, cb) {
  var query = {};
  if (typeof name !== 'function') {
    query.name = name;
  } else {
    cb = name;
  }
  mongoPool.acquire(function (err, client) {
    if (err) {
      return cb(exception(exception.MongoPoolError, err.message));
    }
    client
      .db('blog')
      .collection('posts')
      .count(query, function (err, res) {
        if (err) {
          mongoPool.release(client);
          return cb(exception(exception.DBError, err.message));
        }
        mongoPool.release(client);
        cb(null, res);
      });
  });
};

exports.getArchive = function (cb) {
  mongoPool.acquire(function (err, client) {
    if (err) {
      return cb(exception(exception.MongoPoolError, err.message));
    }
    client
      .db('blog')
      .collection('posts')
      .find({}, {"time": 1, "title": 1})
      .sort({time: -1})
      .toArray(function (err, docs) {
        if (err) {
          mongoPool.release(client);
          return cb(exception(exception.DBError, err.message));
        }
        docs.forEach(function (doc) {
          doc.time = moment(doc.time).format('YYYY-MM-DD');
        });
        mongoPool.release(client);
        cb(null, docs);
      });
  });
};

exports.getTags = function (cb) {
  mongoPool.acquire(function (err, client) {
    if (err) {
      return cb(exception(exception.MongoPoolError, err.message));
    }
    client
      .db('blog')
      .collection('posts')
      .distinct("tags", function (err, res) {
        if (err) {
          mongoPool.release(client);
          return cb(exception(exception.DBError, err.message));
        }
        mongoPool.release(client);
        cb(null, res);
      });
  });
};

exports.getTag = function (tag, cb) {
  mongoPool.acquire(function (err, client) {
    if (err) {
      return cb(exception(exception.MongoPoolError, err.message));
    }
    client
      .db('blog')
      .collection('posts')
      .find({"tags": tag}, {"title": 1, "time": 1})
      .toArray(function (err, docs) {
        if (err) {
          mongoPool.release(client);
          return cb(exception(exception.DBError, err.message));
        }
        docs.forEach(function (doc) {
          doc.time = moment(doc.time).format('YYYY-MM-DD');
        });
        mongoPool.release(client);
        cb(null, docs);
      });
  });
};

exports.search = function (keyword, cb) {
  var pattern = new RegExp(keyword, "i");
  mongoPool.acquire(function (err, client) {
    if (err) {
      return cb(exception(exception.MongoPoolError, err.message));
    }
    client
      .db('blog')
      .collection('posts')
      .find({"title": pattern}, {"time": 1, "title": 1})
      .toArray(function (err, docs) {
        if (err) {
          mongoPool.release(client);
          return cb(exception(exception.DBError, err.message));
        }
        docs.forEach(function (doc) {
          doc.time = moment(doc.time).format('YYYY-MM-DD');
        });
        mongoPool.release(client);
        cb(null, docs);
      });
  });
};

exports.getOne = function (id, cb) {
  mongoPool.acquire(function (err, client) {
    if (err) {
      return cb(exception(exception.MongoPoolError, err.message));
    }
    client
      .db('blog')
      .collection('posts')
      .findAndModify({"_id": new ObjectID(id)}, [], {"$inc": {pv: 1}}, {new: true}, function (err, doc) {
        if (err) {
          mongoPool.release(client);
          return cb(exception(exception.DBError, err.message));
        }
        if (!doc) {
          mongoPool.release(client);
          return cb(exception(exception.NotFound, 'NotFound ' + id));
        }
        doc.content = marked(doc.content);
        doc.time = moment(doc.time).format('YYYY-MM-DD HH:mm');
        doc.comments.forEach(function (comment) {
          comment.content = marked(comment.content);
          comment.time = moment(comment.time).format('YYYY-MM-DD HH:mm');
        });
        mongoPool.release(client);
        cb(null, doc);
      });
  });
};

exports.postOne = function (id, newComment, cb) {
  mongoPool.acquire(function (err, client) {
    if (err) {
      return cb(exception(exception.MongoPoolError, err.message));
    }
    client
      .db('blog')
      .collection('posts')
      .update({"_id": new ObjectID(id)}, {"$push": {"comments": newComment}}, function (err, res) {
        if (err) {
          mongoPool.release(client);
          return cb(exception(exception.DBError, err.message));
        }
        if (!res) {
          mongoPool.release(client);
          return cb(exception(exception.NotFound, 'NotFound ' + id));
        }
        mongoPool.release(client);
        cb(null, res);
      });
  });
};

exports.getEdit = function (id, name, cb) {
  mongoPool.acquire(function (err, client) {
    if (err) {
      return cb(exception(exception.MongoPoolError, err.message));
    }
    client
      .db('blog')
      .collection('posts')
      .findOne({"_id": new ObjectID(id), "name": name}, function (err, doc) {
        if (err) {
          mongoPool.release(client);
          return cb(exception(exception.DBError, err.message));
        }
        if (!doc) {
          mongoPool.release(client);
          return cb(exception(exception.NotFound, 'NotFound ' + id));
        }
        mongoPool.release(client);
        cb(null, doc);
      });
  });
};

exports.postEdit = function (id, name, doc, cb) {
  mongoPool.acquire(function (err, client) {
    if (err) {
      return cb(exception(exception.MongoPoolError, err.message));
    }
    var tags = {};
    doc.tags.forEach(function (tag) {
      if (tag) {
        tags[tag.toLowerCase()] = 1;
      }
    });
    doc.tags = Object.keys(tags);
    client
      .db('blog')
      .collection('posts')
      .update({"_id": new ObjectID(id), "name": name}, {"$set": doc}, function (err, res) {
        if (err) {
          mongoPool.release(client);
          return cb(exception(exception.DBError, err.message));
        }
        if (!res) {
          mongoPool.release(client);
          return cb(exception(exception.NotFound, 'NotFound ' + id));
        }
        mongoPool.release(client);
        cb(null, res);
      });
  });
};

exports.getDelete = function (id, name, cb) {
  mongoPool.acquire(function (err, client) {
    if (err) {
      return cb(exception(exception.MongoPoolError, err.message));
    }
    client
      .db('blog')
      .collection('posts')
      .remove({"_id": new ObjectID(id), "name": name}, function (err, res) {
        if (err) {
          mongoPool.release(client);
          return cb(exception(exception.DBError, err.message));
        }
        if (!res) {
          mongoPool.release(client);
          return cb(exception(exception.NotFound, 'NotFound ' + id));
        }
        mongoPool.release(client);
        cb(null, res);
      });
  });
};

exports.getReprint = function (id, currentUser, cb) {
  mongoPool.acquire(function (err, client) {
    if (err) {
      return cb(exception(exception.MongoPoolError, err.message));
    }
    client
      .db('blog')
      .collection('posts')
      .findAndModify({"_id": new ObjectID(id)}, [], {"$inc": {reprint_num: 1}}, {new: true}, function (err, doc) {
        if (err) {
          mongoPool.release(client);
          return cb(exception(exception.DBError, err.message));
        }
        if (!doc) {
          mongoPool.release(client);
          return cb(exception(exception.NotFound, 'NotFound ' + id));
        }

        delete doc._id;

        doc.reprint_id = id;
        doc.reprint_num = 0;
        doc.title = doc.title.match(/^\[转\]/) ? doc.title : "[转]" + doc.title;
        doc.name = currentUser.name;
        doc.avatar = currentUser.avatar;
        doc.time = Date.now();
        doc.comments = [];
        doc.pv = 0;

        client
          .db('blog')
          .collection('posts')
          .insert(doc, function (err, res) {
            if (err) {
              mongoPool.release(client);
              return cb(exception(exception.DBError, err.message));
            }
            mongoPool.release(client);
            cb(null, res);
          });
      });
  });
};