var path        = require('path');
var fs          = require('fs');
var readdirp    = require('readdirp');
var is_windows  = process.platform === 'win32';

module.exports = function() {
  var watched_files       = {};
  var watched_directories = {};
  var check_dir_pause     = 1000;
  var checkInterval       = undefined;

  // @api public
  // Watches the directory passed and its contained files
  // accepts args as an object.

  // @param root(string): the root directory to watch
  // @param fileFilter(array): ignore these files
  // @param directoryFilter(array): ignore these files
  // @param listener(fn(file)): on file change event this will be called
  // @param complete(fn): on complete of file watching setup
  function watchDirectory(args) {
    readdirp({ root: args.root, fileFilter: args.fileFilter, directoryFilter: args.directoryFilter }, function(err, res) {
      res.files.forEach(function(file) {
        watchFile(file, args.listener, args.partial);
      });
      typeof args.complete == "function" && args.complete();
    });

    !args.partial && (checkInterval = setInterval(function() {checkDirectory(args)}, check_dir_pause));
  }

  // @api public
  // Watches the files passed
  // accepts args as an object.
  // @param files(array): a list of files to watch
  // @param listener(fn(file)): on file change event this will be called
  // @param complete(fn): on complete of file watching setup
  function watchFiles(args) {
    args.files.forEach(function(file) {
      var o = {
            fullPath: fs.realpathSync(file),
            name: fs.realpathSync(file).split('/').pop()
          };
      o.fullParentDir = o.fullPath.split('/').slice(0, o.fullPath.split('/').length - 1).join('/')

      watchFile(o, args.listener);
    });

    typeof args.complete == "function" && args.complete();
  }

  function unwatchAll() {
    if (is_windows) {
      Object.keys(watched_files).forEach(function(key) {
        watched_files[key].close();
      });
    } else {
      Object.keys(watched_files).forEach(function(key) {
        fs.unwatchFile(key);
      });
    }

    clearInterval(checkInterval);
    watched_files       = {};
    watched_directories = {};
  }

  // Checks to see if something in the directory has changed
  function checkDirectory(args) {
    Object.keys(watched_directories).forEach(function(path) {
      var lastModified = watched_directories[path];
      fs.stat(path, function(err, stats) {
        var stats_stamp = lastModified;
        if (!err) {
          stats_stamp = (new Date(stats.mtime)).getTime();
        }
        if (stats_stamp != lastModified) {
          watched_directories[path] = stats_stamp;
          watchDirectory({
            root: path,
            listener: args.listener,
            fileFilter: args.fileFilter,
            directoryFilter: args.directoryFilter,
            partial: true
          });
        }
      });
    });
  }

  // sets the absolute path to the file from the current working dir
  function setAbsolutePath(file) {
    file.absolutePath = path.resolve(process.cwd(), file.fullPath);
    return file.absolutePath;
  }

  // Watches the file passed and its containing directory
  // on change calls given listener with file object
  function watchFile(file, cb, partial) {
    setAbsolutePath(file);
    storeDirectory(file);
    if (!watched_files[file.fullPath]) {
      if (is_windows) {
        (function() {
          watched_files[file.fullPath] = fs.watch(file.fullPath, function() {
            typeof cb === "function" && cb(file);
          });
          partial && cb(file);
        })(file, cb);
      } else {
        (function(file, cb) {
          watched_files[file.fullPath] = true;
          fs.watchFile(file.fullPath, {interval: 150}, function() {
            typeof cb === "function" && cb(file);
          });
          partial && cb(file);
        })(file, cb);
      }
    }
  }

  // Sets up a store of the folders being watched
  // and saves the last modification timestamp for it
  function storeDirectory(file) {
    var directory = file.fullParentDir;
    if (!watched_directories[directory]) {
      fs.stat(directory, function(err, stats) {
        if (err) {
          watched_directories[directory] = (new Date).getTime();
        } else {
          watched_directories[directory] = (new Date(stats.mtime)).getTime();
        }
      });
    }
  }

  // distinguish be files and directories
  // return am object of two arrays

  function distinguishPathes(pathes) {
    pathes = Array.isArray(pathes) ? pathes : [pathes];
    var result = {
      directories: [],
      files: []
    };
    pathes.forEach(function(name) {
      if (fs.statSync(name).isDirectory()) {
        result.directories.push(name);
      } else {
        result.files.push(name);
      }
    });
    return result;
  };

  // for functions accepts an object as paramter
  // copy the object and modify with attributes
  function extend(prototype, attributes) {
    var object = {};
    Object.keys(prototype).forEach(function(key) {
      object[key] = prototype[key];
    });
    Object.keys(attributes).forEach(function(key) {
      object[key] = attributes[key];
    });
    return object;
  };

  // watch files if the pathes refer to files, or directories
  function watchPathes(args) {
    var result = distinguishPathes(args.path)
    if (result.directories.length) {
      result.directories.forEach(function(directory) {
        watchDirectory(extend(args, {root: directory}));
      });
    }
    if (result.files.length)
      watchFiles(extend(args, {files: result.files}));
  }

  return {
    watchDirectory: watchDirectory,
    watchFiles: watchFiles,
    watchPathes: watchPathes,
    unwatchAll: unwatchAll
  };
}
