#!/usr/bin/env node

var _ = require('lodash');
var fs = require('fs');
var colors = require('colors');
var async = require('async');
var config = require('./config');
var rimraf = require('rimraf');
var glob = require('glob');
var _ = require('lodash');
var mkdirp = require('mkdirp');
var TEMP_FOLDER = config.TEMP_FOLDER;

var gitUpdater = require('./updaters/git')

// Check if auto update enabled for library
var checkAutoUpdate = function(package) {
  if(typeof package.autoupdate === 'object') {
    return true;
  } else {
    return false;
  }
}

var startAutoUpdate = function(package, callback) {
  console.log('\n');
  console.log(package.name.yellow)
  var source = package.autoupdate.source;
  switch (source) {
    case 'git': 
      gitUpdater.update(package, callback);
      break;
    default:
      console.log('Autoupdate type not supportted'.red);
      callback(null, 0);
  }
}

var initialize = function (err) {
  if (!err) {
    console.log('Starting Auto Update'.cyan)
    console.log('-----------------------');
    var filenames = glob.sync(__dirname + "/../cdnjs/ajax/libs/*/package.json");
    var packages = _.chain(filenames)
      .map(function(filename) {
        return JSON.parse(fs.readFileSync(filename, 'utf8'))
      })
      .filter(function(package) {
        return typeof package.autoupdate === 'object';
      })
      .value();
    async.eachLimit(packages, 16, function (package, callback) {
        startAutoUpdate(package, callback);
    }, function () {
      console.log('\n');
      console.log('-----------------------');
      console.log('Auto Update Completed'.green)
    });
  } else {
    console.error("Got an error: " + err);
  }
}

rimraf.sync(TEMP_FOLDER);
mkdirp(TEMP_FOLDER, initialize);
