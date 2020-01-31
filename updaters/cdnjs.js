var fs = require('fs');
var path = require('path');

if (process.env.BOT_BASE_PATH === undefined) {
  throw 'BOT_BASE_PATH is missing';
}
const BOT_BASE_PATH = process.env.BOT_BASE_PATH;

var getlibraryPath = function (pkg, version) {
  return path.normalize(path.join(BOT_BASE_PATH, 'cdnjs', 'ajax', 'libs', pkg.name, version));
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
