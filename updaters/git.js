
var config = require('../config');
var TEMP_FOLDER = config.TEMP_FOLDER;
var git = require('gift');
var async = require('async');
var _ = require('lodash');
var path = require('path');
var glob = require('glob');
var cdnjs = require('./cdnjs');
var fs = require('fs-extra');

var update = function (package, callback) {
  var target = package.autoupdate.target;
  console.log('Clone', target);
  git.clone(target, TEMP_FOLDER + package.name, function(err, repo) {
    if (err) {
      throw err;
    }
    repo.tags(function(err, tags){
      var versions = _.map(tags, function(tag){ return tag.name});
      var needed = _.filter(versions, function(version){
        if(version[0] === 'v') {
          version = version.substr(1);
        }
        if(!cdnjs.checkVersion(package, version)) {
          return true;
        } else {
          return false;
        }
      });
      if(needed.length > 0){
        console.log('Need', needed.join(',').blue);
      }
      async.eachSeries(needed, function (tag, callback) {
          repo.checkout(tag, function () {
            if(tag[0] === 'v') {
              tag = tag.substr(1);
            }
            var basePath = package.autoupdate.basePath || "";
            var libContentsPath = path.normalize(path.join(TEMP_FOLDER, package.name, basePath));
            var allFiles = [];
            _.each(package.autoupdate.files, function (file){
               var files = glob.sync(path.normalize(path.join(libContentsPath, file)));
               if(files.length ===0) {
                console.log('Not found'.red, file.cyan, tag);
               };
               allFiles = allFiles.concat(files);

            });
            console.log('All files for this version', allFiles.length);
              console.log(allFiles.length, allFiles.length !==0)

            if(allFiles.length !==0){
              console.log('Updated package.json to version'.green, tag);
              var packagePath = path.normalize(path.join(__dirname, '../../cdnjs', 'ajax', 'libs', package.name, 'package.json'));
              var packageJSON = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
              packageJSON.version = tag;
              fs.writeFileSync(packagePath, JSON.stringify(packageJSON, undefined, 4));
            } 
            async.eachSeries(allFiles, function(file, callback){
              var fileName = path.relative(path.join(TEMP_FOLDER, package.name, basePath), file);
              var fileTarget = path.normalize(path.join(__dirname, '../../cdnjs', 'ajax', 'libs', package.name, tag, fileName));
              fs.ensureFile(fileTarget, function(err) {
                if(err){
                  console.log('Some strange error occured here'.red);
                  callback();
                } else {
                  fs.copy(file, fileTarget, function (err) {
                    if(err){
                      console.log('Some strange error occured here'.red);
                      callback();
                    } else {
                      callback();
                    }
                  })
                }
              })
            }, function () {
              callback();
            })
          })

      }, function () {
        console.log('Updated from Git'.green);
        callback(null, 1);
      });
    })
  });

};

module.exports = {
  update: update
}
