var fs = require('fs');
var path = require('path');

var getlibraryPath = function (pkg, version) {
  return path.normalize(path.join(__dirname, '../../cdnjs', 'ajax', 'libs', pkg.name, version));
};

var checkVersion = function (library, version) {
  var libPath = getlibraryPath(library, version);
  if (fs.existsSync(libPath)) {
    return true;
  }

  return false;
};

module.exports = {
  checkVersion: checkVersion,
  getlibraryPath: getlibraryPath
};
