
var config = require('../config'),
  TEMP_FOLDER = config.TEMP_FOLDER,
  git = require('gift'),
  async = require('async'),
  _ = require('lodash'),
  path = require('path'),
  glob = require('glob'),
  cdnjs = require('./cdnjs'),
  fs = require('fs-extra'),
  stable = require('semver-stable'),
  compareVersions = require('compare-versions');

var update = function(package, callback) {
  var target = package.autoupdate.target;
  console.log('Clone', target);
  git.clone(target, TEMP_FOLDER + package.name, function(err, repo) {
    if (err) {
      throw err;
    }
    repo.tags(function(err, tags) {
      var versions = _.map(tags, function(tag) {return tag.name});
      var needed = _.filter(versions, function(version) {
        if (version[0] === 'v' || version[0] === 'V') {
          version = version.substr(1);
        }
        if (!cdnjs.checkVersion(package, version)) {
          return true;
        } else {
          return false;
        }
      });
      if (needed.length > 0) {
        console.log('Need', needed.join(',').blue);
      }
      async.eachSeries(needed, function(tag, callback) {
          repo.checkout(tag, function() {
            if (tag[0] === 'v' || tag[0] === 'V') {
              tag = tag.substr(1);
            }
            var basePath = package.autoupdate.basePath || "",
              libContentsPath = path.normalize(path.join(TEMP_FOLDER, package.name, basePath)),
               allFiles = [];
            _.each(package.autoupdate.files, function(file) {
               var files = glob.sync(path.normalize(path.join(libContentsPath, file)), {nodir: true, realpath: true});
               if (files.length === 0) {
                console.log('Not found'.red, file.cyan, tag);
                fs.mkdirsSync(path.normalize(path.join(__dirname, '../../cdnjs', 'ajax', 'libs', package.name, tag)));
               };
               allFiles = allFiles.concat(files);

            });
            console.log('All files for this version', allFiles.length);
              console.log(allFiles.length, allFiles.length !== 0)
            package.version = package.version || "0.0.0";
            if (allFiles.length !== 0 && stable.is(tag) && compareVersions(tag, package.version) > 0) {
              console.log('Updated package.json to version'.green, tag);
              var packagePath = path.normalize(path.join(__dirname, '../../cdnjs', 'ajax', 'libs', package.name, 'package.json')),
                packageJSON = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
              packageJSON.version = tag;
              fs.writeFileSync(packagePath, JSON.stringify(packageJSON, undefined, 2)  + '\n');
            } 
            async.eachSeries(allFiles, function(file, callback) {
              var fileName = path.relative(path.join(TEMP_FOLDER, package.name, basePath), file),
                fileTarget = path.normalize(path.join(__dirname, '../../cdnjs', 'ajax', 'libs', package.name, tag, fileName));
              fs.ensureFile(fileTarget, function(err) {
                if (err) {
                  console.log('Some strange error occured here'.red);
                  console.dir(err);
                  callback();
                } else {
                  fs.copy(file, fileTarget, function(err) {
                    if (err) {
                      console.dir(err);
                      console.log('Some strange error occured here'.red);
                      callback();
                    } else {
                      callback();
                    }
                  })
                }
              })
            }, function() {
              callback();
            })
          })

      }, function() {
        console.log('Updated from Git'.green);
        fs.removeSync(TEMP_FOLDER + package.name);
        callback(null, 1);
      });
    })
  });

};

module.exports = {
  update: update
}
