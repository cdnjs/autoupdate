#!/usr/bin/env node

var _ = require('lodash');
var fs = require('fs-extra');
var async = require('async');
var config = require('./config');
var path = require('path');
var glob = require('glob');
var GIT_REPO_LOCAL_FOLDER = config.GIT_REPO_LOCAL_FOLDER;
var gitUpdater = require('./updaters/git');

if (process.env.AUTOUPDATE_CONCURRENT_LIMIT === undefined) {
  throw 'AUTOUPDATE_CONCURRENT_LIMIT is missing';
}

var asyncLimit = parseInt(process.env.AUTOUPDATE_CONCURRENT_LIMIT);

var startAutoUpdate = function (library, callback) {
  console.log('\n');
  console.log(library.name.yellow);
  var source = library.autoupdate.source;
  switch (source) {
    case 'git':
      gitUpdater.update(library, callback);
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
      __dirname, config.CDNJS_FOLDER, '/ajax/libs/' + globPattern + '/package.json'
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
