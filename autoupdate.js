#!/usr/bin/env node

var _ = require('lodash');
var fs = require('fs-extra');
var async = require('async');
var config = require('./config');
var path = require('path');
var glob = require('glob');
var GIT_REPO_LOCAL_FOLDER = config.GIT_REPO_LOCAL_FOLDER;
var gitUpdater = require('./updaters/git');
var npmUpdater = require('./updaters/npm');

if (process.env.AUTOUPDATE_CONCURRENT_LIMIT === undefined) {
  throw 'AUTOUPDATE_CONCURRENT_LIMIT is missing';
}
if (process.env.BOT_BASE_PATH === undefined) {
  throw 'BOT_BASE_PATH is missing';
}
const BOT_BASE_PATH = process.env.BOT_BASE_PATH;

var asyncLimit = parseInt(process.env.AUTOUPDATE_CONCURRENT_LIMIT);

var startAutoUpdate = function (library, callback) {
  // if the package has a .do_not_update file we ignore the update process for
  // it and move on.
  const doNotUpdatePath = path.join(
    process.env.BOT_BASE_PATH, "cdnjs", 'ajax', 'libs',  library.name, '.do_not_update'
  )
  if (fs.existsSync(doNotUpdatePath)) {
    console.log('package has .do_not_update; ignore');
    return callback(null, 0)
  }

  console.log('\n');
  console.log(library.name.yellow);
  var source = library.autoupdate.source;
  switch (source) {
    case 'git':
      gitUpdater.update(library, callback);
      break;
    case 'npm':
      npmUpdater.update(library, callback);
      break;
    default:
      console.log('Autoupdate type not supportted'.red);
      callback(null, 0);
  }
};

var initialize = function (err) {
  if (err) {
    console.error('Got an error: ' + err);
  } else {
    console.log('Starting Auto Update'.cyan);
    console.log('-----------------------');
    var args = process.argv.slice(2);
    var globPattern = (args.length === 1) ? args[0] : '*';
    var filenames = glob.sync(path.normalize(path.join(
      process.env.BOT_BASE_PATH, "cdnjs", 'ajax', 'libs',  globPattern, 'package.json'
    )));
    var librarys = _.chain(filenames)
      .map(function (filename) {
        return JSON.parse(fs.readFileSync(filename, 'utf8'));
      })
      .filter(function (library) {
        return typeof library.autoupdate === 'object';
      })
      .value();
    async.eachLimit(librarys, asyncLimit, function (library, callback) {
      startAutoUpdate(library, callback);
    }, function () {

      console.log('\n');
      console.log('-----------------------');
      console.log('Auto Update Completed'.green);
    });
  }
};

fs.mkdirpSync(GIT_REPO_LOCAL_FOLDER);
initialize();

process.on('uncaughtException', (err) => {
  console.log(err);
});
