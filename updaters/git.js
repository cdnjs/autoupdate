
var config = require('../config');
var TEMP_FOLDER = config.TEMP_FOLDER;
var git = require('gift');
var async = require('async');
var _ = require('lodash');
var path = require('path');
var glob = require('glob');
var cdnjs = require('./cdnjs');
var fs = require('fs-extra');
var stable = require('semver-stable');
var compareVersions = require('compare-versions');
var colors = require('colors');

var update = function(library, callback) {
  var target = library.autoupdate.target;
  console.log('Clone', target);
  git.clone(target, TEMP_FOLDER + library.name, function(err, repo) {
    if (err) {
      throw err;
    }
    repo.tags(function(err, tags) {
      if (err) {
        console.dir(err);
      }
      var versions = _.map(tags, function(tag) {
        return tag.name;
      });
      var needed = _.filter(versions, function(version) {
        if (version[0] === 'v' || version[0] === 'V') {
          version = version.substr(1);
        }
        return (!cdnjs.checkVersion(library, version));
      });
      if (needed.length > 0) {
        console.log('Need', needed.join(',').blue);
      }
      async.eachSeries(needed, function(tag, callback) {
        repo.checkout(tag, function() {
          if (tag[0] === 'v' || tag[0] === 'V') {
            tag = tag.substr(1);
          }
          var basePath = library.autoupdate.basePath || "";
          var libContentsPath = path.normalize(path.join(TEMP_FOLDER, library.name, basePath));
          var allFiles = [];

          _.each(library.autoupdate.fileMap, function(mapGroup) {
             var cBasePath = mapGroup.basePath || "",
                 files = [];
             libContentsPath = path.normalize(path.join(TEMP_FOLDER, library.name, cBasePath)),
             _.each(mapGroup.files, function (cRule) {
                 var newFiles = glob.sync(path.normalize(path.join(libContentsPath, cRule)), {nodir: true, realpath: true});
                 files = files.concat(newFiles);
                 if (newFiles.length === 0) {
                  console.log('Not found (using `autoupdate.fileMap`)'.red, cRule.cyan, tag);
                  fs.mkdirsSync(path.normalize(path.join(__dirname, '../../cdnjs', 'ajax', 'libs', lib.name, tag)));
                 }
             });
             allFiles = allFiles.concat(files.map(function (c) {
                 return {
                     _: c,
                     basePath: cBasePath
                 }
             }));
          });
          console.log('All files for this version', allFiles.length);
          console.log(allFiles.length, allFiles.length !== 0);
          library.version = library.version || "0.0.0";
          if (allFiles.length !== 0 && stable.is(tag) && compareVersions(tag, library.version) > 0) {
            console.log('Updated package.json to version'.green, tag);
            var libraryPath = path.normalize(path.join(__dirname, '../../cdnjs', 'ajax', 'libs', library.name, 'package.json'));
            var libraryJSON = JSON.parse(fs.readFileSync(libraryPath, 'utf8'));
            libraryJSON.version = tag;
            fs.writeFileSync(libraryPath, JSON.stringify(libraryJSON, undefined, 2) + '\n');
          }
          async.eachSeries(allFiles, function(file, callback) {
            var fileName = path.relative(path.join(TEMP_FOLDER, library.name, file.basePath), file._);
            var fileTarget = path.normalize(path.join(__dirname, '../../cdnjs', 'ajax', 'libs', library.name, tag, fileName));
            fs.ensureFile(fileTarget, function(err) {
              if (err) {
                console.log('Some strange error occured here'.red);
                console.dir(err);
                callback();
              } else {
                fs.copy(file._, fileTarget, function(err) {
                  if (err) {
                    console.dir(err);
                    console.log('Some strange error occured here'.red);
                    callback();
                  } else {
                    callback();
                  }
                });
              }
            });
          }, function() {
            callback();
          });
        });
      }, function() {
        console.log('Updated from Git'.green);
        fs.removeSync(TEMP_FOLDER + library.name);
        callback(null, 1);
      });
    });
  });
};

module.exports = {
  update: update
};

