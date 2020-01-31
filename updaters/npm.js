var config = require('../config');
var GIT_REPO_LOCAL_FOLDER = config.GIT_REPO_LOCAL_FOLDER;
var isThere = require('is-there');
var colors = require('colors');
var _ = require('lodash');
var path = require('path');
var request = require('superagent');
var tarball = require('tarball-extract');

var assert = require('assert');
var fs = require('fs-extra');
var glob = require('glob');
var _ = require('lodash');
var async = require('async');
var stable = require('semver-stable');
var semver = require('semver');

var tempDirPath;
var args;

if (process.env.BOT_CDNJS_NPM_TEMP === undefined) {
  throw 'BOT_CDNJS_NPM_TEMP is missing';
}
tempDirPath = process.env.BOT_CDNJS_NPM_TEMP;


var newVersionCount = 0;
var parse = function(jsonFile, ignoreMissing, ignoreParseFail) {
  var content;

  try {
    content = fs.readFileSync(jsonFile, 'utf8');
  } catch (err1) {
    if (!ignoreMissing) {
      assert.ok(0, jsonFile + " doesn't exist!");
    }
    return null;
  }
  try {
    return JSON.parse(content);
  } catch (err2) {
    if (!ignoreParseFail) {
      // assert.ok(0, jsonFile + " failed to parse");
    }
    return null;
  }
};

var reEscape = function(s) {
  return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
};

/**
 * Check if an npmFileMap object contains any path which are not normalized, and thus could allow access to parent dirs
 * @param pkg
 * @returns {*}
 */
var isValidFileMap = function(pkg) {
  var isValidPath = function(p) {
    if (p !== null) { // don't allow parent dir access, or tricky paths
      p = p.replace(/\/+/g, '/'); // don't penalize for consequtive path seperators
      return p === path.normalize(p);
    }
    return false;
  };

  if (pkg && pkg.autoupdate && pkg.autoupdate.fileMap) {
    return _.every(pkg.autoupdate.fileMap, function(fileSpec) {
      if (isValidPath(fileSpec.basePath || "/")) {
        return _.every(fileSpec.files, isValidPath);
      }
      return false;
    });
  }
  return false;
};

var error = function(msg, name) {
  var err = new Error(msg);
  err.name = name;
  console.log(msg.red);
  return err;
};

error.PKG_NAME = 'BadPackageName';
error.FILE_PATH = 'BadFilePath';

/**
 * returns a fucntion that takes N args, where each arg is a path that must not outside of libPath.
 * returns true if all paths are within libPath, else false
 */
var isAllowedPathFn = function(libPath) { // is path within the lib dir? if not, they shouldnt be writing/reading there
  libPath = path.normalize(libPath || "/");
  return function() {
    var paths = arguments.length >= 1 ? [].slice.call(arguments, 0) : [];
    var re = new RegExp("^" + reEscape(libPath));
    return _.every(paths, function(p) {
      p = path.normalize(p);
      return p.match(re);
    });
  };
};

var invalidNpmName = function(name) {
  return (name.indexOf("..") !== -1); // doesnt contain
};

var getPackagePath = function(pkg, version) {
  return path.normalize(path.join(__dirname, '../', "../cdnjs/ajax/libs", pkg.name, version));
};

var getPackageTempPath = function(pkg, version) {
  return path.normalize(path.join(__dirname, '../', GIT_REPO_LOCAL_FOLDER, pkg.name, version));
};

var processNewVersion = function(library, version) {

  // sometimes the tar is extracted to a dir that isnt called 'package' - get that dir via glob
  var extractLibPath = glob.sync(getPackageTempPath(library, version) + "/*/")[0];
  var npmName = library.autoupdate.target;

  if (!extractLibPath) {
    // even more rarely, the tar doesnt seem to get extracted at all.. which is probably a bug in that lib.
    var msg = npmName + "@" + version +
      " - never got extracted! This problem usually goes away on next run." +
      " Couldnt find extract dir here: " + getPackageTempPath(library, version);
    console.log(msg.red);
    return;
  }

  var libPath = getPackagePath(library, version);
  var isAllowedPath = isAllowedPathFn(extractLibPath);
  var newPath = path.join(libPath, 'package.json');

  if (isThere(newPath)) { // turn this off for now
    var newPkg = parse(newPath);
    if (isValidFileMap(newPkg)) {
      library.npmFileMap = newPkg.npmFileMap;
    }
  }

  var npmFileMap = library.npmFileMap;
  var errors = [];
  var updated = false;
  _.each(npmFileMap, function(fileSpec) {
    var basePath = fileSpec.basePath || "";

    _.each(fileSpec.files, function(file) {
      var libContentsPath = path.normalize(path.join(extractLibPath, basePath));
      if (!isAllowedPath(libContentsPath)) {
        errors.push(error(npmName + " contains a malicious file path: " +
          libContentsPath, error.FILE_PATH));
        return;
      }
      var files = glob.sync(path.join(libContentsPath, file));
      if (files.length === 0) {
        // usually old versions have this problem
        var msg;
        msg = (npmName + "@" + version + " - couldnt find file in npmFileMap.") +
          (" Doesnt exist: " + path.join(libContentsPath, file)).info;
        fs.mkdirsSync(libPath);
        console.log(msg);
      }

      _.each(files, function(extractFilePath) {
        if (extractFilePath.match(/(dependencies|\.zip\s*$)/i)) {
          return;
        }
        var copyPart = path.relative(libContentsPath, extractFilePath);
        var copyPath = path.join(libPath, copyPart);
        fs.mkdirsSync(path.dirname(copyPath));
        fs.copySync(extractFilePath, copyPath);
        updated = true;
      });
    });
  });
  if (updated) {
    newVersionCount++;
    var libPatha = path.normalize(path.join(__dirname, 'ajax', 'libs', library.name, 'package.json'));
    console.log('------------'.red, libPatha.green);
    if (
      (!library.version) ||
      (
        semver.gt(version, library.version) &&
        (
          stable.is(version) ||
          (!stable.is(version) && !stable.is(library.version))
        )
      )
    ) {
      library.version = version;
      fs.writeFileSync(libPatha, JSON.stringify(library, null, 2) + '\n', 'utf8');
    }
  }
  return errors;
};

var updateLibraryVersion = function(library, tarballUrl, version, cb) {
  var npmName = library.autoupdate.target;
  if (invalidNpmName(library.name)) {
    return cb(error(npmName + " has a malicious package name:" + library.name, error.PKG_NAME));
  }

  var extractLibPath = getPackageTempPath(library, version);
  var libPath = getPackagePath(library, version);

  if (isThere(libPath)) {
    cb();
  } else {
    fs.mkdirsSync(extractLibPath);
    var url = tarballUrl;
    var msg;
    var downloadFile = path.join(extractLibPath, 'dist.tar.gz');
    tarball.extractTarballDownload(url, downloadFile, extractLibPath, {}, function(err, result) {
      if (!err && isThere(downloadFile)) {
        msg = "Found version " + version + " of " +
          npmName + ", now try to import it.";
        console.log(msg.yellow);
        processNewVersion(library, version);
      } else if (result.error === 'Server respond 404') {
        msg = "Got 404 on version " + version + " of " + npmName +
          ", create an empty folder for it.";
        fs.mkdirsSync('./ajax/libs/' + library.name + '/' + version);
        console.log(msg.yellow);
      } else {
        msg = "error downloading " + version + " of " + npmName +
          " it didnt exist: " + result.error;
        console.log(msg.red);
      }
      cb();
    });
  }
};

var update = function(library, callback) {
  var msg;

  var target = library.autoupdate.target;
  if (!isValidFileMap(library)) {
    msg = target.red + " has a malicious npmFileMap";
    console.log(msg.yellow);
    return callback();
  }

  msg = 'Checking versions for ' + target;
  if (library.name !== target) {
    msg += ' (' + library.name + ')';
  }
  console.log(msg.blue);

  var npmNameScopeReg = /^@.+\/.+$/;
  if (npmNameScopeReg.test(target)) {
    target = target.replace('/', '%2f');
  }

  request.get('https://registry.npmjs.org/' + target).end(function(error, result) {
    if (result !== undefined && result.body !== undefined) {
      async.each(_.toPairs(result.body.versions), function(p, cb) {
        var data = p[1];
        var version = p[0];
        updateLibraryVersion(library, data.dist.tarball, version, cb);
      }, function(err) {
        msg = 'Library "' + library.name + '" update finished' + (err ? ' ' + err.red : '');
        console.log(msg);
        callback(null);
      });
    } else {
      console.log(('Got error on ' + library.name + ' ! Error: ' + error).red);
      callback();
    }
  });
};

exports.update = update;
