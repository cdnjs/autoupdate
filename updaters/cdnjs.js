var fs = require('fs');
var config = require('../config');
var path = require('path');

var getPackagePath = function(pkg, version){
    return path.normalize(path.join(__dirname, '../../cdnjs', 'ajax', 'libs', pkg.name, version));
}

var checkVersion = function(package, version) {
  var libPath = getPackagePath(package, version);
  if(fs.existsSync(libPath)) {
    return true;
  } else {
    return false;
  }
}


/*
var processNewVersion = function(pkg, version){
    //sometimes the tar is extracted to a dir that isnt called 'package' - get that dir via glob
    var extractLibPath = glob.sync(getPackageTempPath(pkg, version)+"//")[0];

    if(!extractLibPath){
      //even more rarely, the tar doesnt seem to get extracted at all.. which is probably a bug in that lib.
      console.log(pkg.npmName+"@"+version+" - never got extracted! This problem usually goes away on next run. Couldnt find extract dir here: ", getPackageTempPath(pkg, version));
      return;
    }
    var libPath = getPackagePath(pkg, version)

    var isAllowedPath = isAllowedPathFn(extractLibPath);

    var newPath = path.join(libPath, 'package.json')
    if(false && fs.existsSync(newPath)){ //turn this off for now
        var newPkg = parse(newPath);
        if(isValidFileMap(newPkg)){
            pkg.npmFileMap = newPkg.npmFileMap;
        }
    }
    var npmFileMap = pkg.npmFileMap;
    var errors = [];

    var updated = false;

    _.each(npmFileMap, function(fileSpec) {
        var basePath = fileSpec.basePath || "";

        _.each(fileSpec.files, function(file) {
            var libContentsPath = path.normalize(path.join(extractLibPath, basePath));
            if(!isAllowedPath(libContentsPath)){
                errors.push(error(pkg.npmName+" contains a malicious file path: "+libContentsPath, error.FILE_PATH));
                return
            }
            var files = glob.sync(path.join(libContentsPath, file));
            var copyPath = path.join(libPath, basePath)

            if(files.length == 0){
              //usually old versions have this problem
              console.log(pkg.npmName+"@"+version+" - couldnt find file in npmFileMap. Doesnt exist: ", path.join(libContentsPath, file));
            }
          _.each(files, function(extractFilePath) {
                if(extractFilePath.match(/(dependencies|\.zip\s*$)/i)){
                  return;
                }

                var copyPart = path.relative(libContentsPath, extractFilePath);
                var copyPath = path.join(libPath, copyPart)
                fs.mkdirsSync(path.dirname(copyPath))
                fs.renameSync(extractFilePath, copyPath);
                updated = true
            });
        });
    });
    if(updated){
      newVersionCount++;
    }
    return errors;
}*/
module.exports = {
  checkVersion: checkVersion,
  getPackagePath: getPackagePath
}
