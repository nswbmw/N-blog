var fs      = require('fs');
var assert  = require('assert');
var Monocle = require('../monocle');

//
// setup
//
var monocle = null;
var sample_dir = __dirname + '/sample_files';
before(function(){ monocle = Monocle(); });
after(function() {
  fs.unlinkSync(__dirname+"/sample_files/creation.txt");
  fs.unlinkSync(__dirname+"/sample_files/creation2.txt");
  fs.unlinkSync(__dirname+"/sample_files/creation3.txt");
  fs.unlinkSync(__dirname+"/sample_files/creation4.txt");
  fs.unlinkSync(__dirname+"/sample_files/creation5.txt");
  fs.unlinkSync(__dirname+"/sample_files/nestedDir/creation3.txt");
});
//
// file change tests
//

describe("file changes", function() {

  it("should detect a change", function(complete) {
    monocle.watchDirectory({
      root: sample_dir,
      listener: function(f){ cb_helper('foo.txt', f, complete); },
      complete: function(){ complete_helper("/sample_files/foo.txt"); }
    });
  });

  it("should detect a change in a nested dir file", function(complete) {
    monocle.watchDirectory({
      root: sample_dir,
      listener: function(f) { cb_helper('servent.txt', f, complete); },
      complete: function() { complete_helper("/sample_files/nestedDir/servent.txt"); }
    });
  });

  it("should detect a change", function(complete) {
    monocle.watchDirectory({
      root: sample_dir,
      listener: function(f) { cb_helper('longbow.js', f, complete); },
      complete: function() { complete_helper('/sample_files/longbow.js'); }
    });
  });

  it("should detect a change", function(complete) {
    monocle.watchPathes({
      path: sample_dir,
      listener: function(f) { cb_helper('longbow.js', f, complete); },
      complete: function() { complete_helper('/sample_files/longbow.js'); }
    });
  });

});

//
// file add tests
//

describe("file added", function() {
  it("should detect a file added", function(complete) {
    monocle.watchDirectory({
      root: sample_dir,
      listener: function(f) {
        cb_helper("creation.txt", f, complete)
      },
      complete: function() {
        complete_helper('/sample_files/creation.txt');
      }
    });
  });

  it("should detect another file added", function(complete) {
    monocle.watchDirectory({
      root: sample_dir,
      listener: function(f) {
        cb_helper("creation2.txt", f, complete);
      },
      complete: function() {
        complete_helper('/sample_files/creation2.txt');
      }
    });
  });

  it("should detect another file added in a nested folder", function(complete) {
    monocle.watchDirectory({
      root: sample_dir,
      listener: function(f) {
        cb_helper("creation3.txt", f, complete);
      },
      complete: function() {
        complete_helper('/sample_files/nestedDir/creation3.txt');
      }
    });
  });

  it("should detect another file added", function(complete) {
    monocle.watchPathes({
      path: sample_dir,
      listener: function(f) {
        cb_helper("creation2.txt", f, complete);
      },
      complete: function() {
        complete_helper('/sample_files/creation2.txt');
      }
    });
  });

  it("should detect another file added but passed as list", function(complete) {
    monocle.watchPathes({
      path: [sample_dir],
      listener: function(f) {
        cb_helper("creation2.txt", f, complete);
      },
      complete: function() {
        complete_helper('/sample_files/creation2.txt');
      }
    });
  });
});


//
// watch an array of files
//
describe("files watched", function() {
  it("should detect a file changed of multiple", function(complete) {
    complete_helper('/sample_files/creation.txt');
    complete_helper('/sample_files/creation2.txt');
    complete_helper('/sample_files/creation3.txt');

    monocle.watchFiles({
      files: [__dirname+"/sample_files/creation.txt", __dirname+"/sample_files/creation2.txt"],
      listener: function(f) {
        cb_helper("creation2.txt", f, complete)
      },
      complete: function() {
        complete_helper('/sample_files/creation2.txt');
      }
    });
  });

  it("should detect a file changed (delayed)", function(complete) {
    complete_helper('/sample_files/creation3.txt');
    monocle.watchFiles({
      files: [__dirname+"/sample_files/creation3.txt"],
      listener: function(f) {
        setTimeout(function() {
          cb_helper('creation3.txt', f, complete);
        }, 400);
      },
      complete: function() {
        complete_helper('/sample_files/creation3.txt');
      }
    });
  });

  it("should detect a file changed (short delayed)", function(complete) {
    complete_helper('/sample_files/creation4.txt');
    monocle.watchFiles({
      files: [__dirname+"/sample_files/creation4.txt"],
      listener: function(f) {
        setTimeout(function() {
          cb_helper('creation4.txt', f, complete);
        }, 100);
      },
      complete: function() {
        complete_helper('/sample_files/creation4.txt');
      }
    });
  });

  it("should detect a file changed", function(complete) {
    complete_helper('/sample_files/creation.txt');
    monocle.watchFiles({
      files: [__dirname+"/sample_files/creation.txt"],
      listener: function(f) {
        cb_helper("creation.txt", f, complete)
      },
      complete: function() {
        complete_helper('/sample_files/creation.txt');
      }
    });
  });

  it("should not bomb when no callback is passed", function(complete) {
    complete_helper('/sample_files/creation5.txt');
    monocle.watchFiles({
      files: [__dirname+"/sample_files/creation5.txt"],
      complete: function() {
        complete_helper('/sample_files/creation5.txt');
      }
    });
    setTimeout(function() {
      complete();
    }, 300)
  });
});


//
// watch an array of pathes
//
describe("pathes watched", function() {
  it("should detect a file changed of multiple", function(complete) {
    complete_helper('/sample_files/creation.txt');
    complete_helper('/sample_files/creation2.txt');
    complete_helper('/sample_files/creation3.txt');

    monocle.watchPathes({
      path: [__dirname+"/sample_files/creation.txt", __dirname+"/sample_files/creation2.txt"],
      listener: function(f) {
        cb_helper("creation2.txt", f, complete)
      },
      complete: function() {
        complete_helper('/sample_files/creation2.txt');
      }
    });
  });

  it("should detect a file changed (delayed)", function(complete) {
    complete_helper('/sample_files/creation3.txt');
    monocle.watchPathes({
      path: [__dirname+"/sample_files/creation3.txt"],
      listener: function(f) {
        setTimeout(function() {
          cb_helper('creation3.txt', f, complete);
        }, 400);
      },
      complete: function() {
        complete_helper('/sample_files/creation3.txt');
      }
    });
  });

  it("should detect a file changed (short delayed)", function(complete) {
    complete_helper('/sample_files/creation4.txt');
    monocle.watchPathes({
      path: [__dirname+"/sample_files/creation4.txt"],
      listener: function(f) {
        setTimeout(function() {
          cb_helper('creation4.txt', f, complete);
        }, 100);
      },
      complete: function() {
        complete_helper('/sample_files/creation4.txt');
      }
    });
  });

  it("should detect a file changed", function(complete) {
    complete_helper('/sample_files/creation.txt');
    monocle.watchPathes({
      path: [__dirname+"/sample_files/creation.txt"],
      listener: function(f) {
        cb_helper("creation.txt", f, complete)
      },
      complete: function() {
        complete_helper('/sample_files/creation.txt');
      }
    });
  });

  it("should not bomb when no callback is passed", function(complete) {
    complete_helper('/sample_files/creation5.txt');
    monocle.watchPathes({
      path: [__dirname+"/sample_files/creation5.txt"],
      complete: function() {
        complete_helper('/sample_files/creation5.txt');
      }
    });
    setTimeout(function() {
      complete();
    }, 300)
  });
});

//
// watchPathes should be eager to accept string and arrays
//

describe("different parameters of watchPathes", function() {

  it("may be a file", function(complete) {
    monocle.watchPathes({
      path: sample_dir + "/foo.txt",
      listener: function(f) {
        cb_helper("foo.txt", f, complete);
      },
      complete: function() {
        complete_helper('/sample_files/foo.txt');
      }
    });
  });

  it("may be a string of a directory", function(complete) {
    monocle.watchPathes({
      path: sample_dir,
      listener: function(f) {
        cb_helper("foo.txt", f, complete);
      },
      complete: function() {
        complete_helper('/sample_files/foo.txt');
      }
    });
  });

  it("may be a list of directories", function(complete) {
    monocle.watchPathes({
      path: [sample_dir],
      listener: function(f) {
        cb_helper("foo.txt", f, complete);
      },
      complete: function() {
        complete_helper('/sample_files/foo.txt');
      }
    });
  });

  it("may be a list of directory and file", function(complete) {
    monocle.watchPathes({
      path: [sample_dir + "/nestedDir", sample_dir + "/foo.txt"],
      listener: function(f) {
        cb_helper("foo.txt", f, complete);
      },
      complete: function() {
        complete_helper('/sample_files/foo.txt');
      }
    });
  });

  it("may be a list of file and directory", function(complete) {
    monocle.watchPathes({
      path: [sample_dir + "/foo.txt", sample_dir + "/nestedDir"],
      listener: function(f) {
        cb_helper("servent.txt", f, complete);
      },
      complete: function() {
        complete_helper('/sample_files/nestedDir/servent.txt');
      }
    });
  });
});


//
// helpers
//

function cb_helper(name, file, done){
  if (file.name === name) { monocle.unwatchAll(); done(); }
}

function complete_helper(path){
  fs.writeFile(__dirname + path, (new Date).getTime() + "\n");
}
