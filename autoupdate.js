#!/usr/bin/env node

//https://github.com/lodash/lodash/tree/2.4.1
var _ = require('lodash');
var fs = require('fs');
var utils = require('./utils');
var colors = require('colors');
var async = require('async');
var config = require('./config');
var rimraf = require('rimraf');
var glob = require('glob');
var _ = require('lodash');
var TEMP_FOLDER = config.TEMP_FOLDER;

var gitUpdater = require('./updaters/git')

// Temp

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

var initialize = function () {
	console.log('Starting Auto Update'.cyan)
	console.log('-----------------------');
	var filenames = glob.sync(__dirname + "/../cdnjs/ajax/libs/*/*.json");
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
}

rimraf.sync(TEMP_FOLDER);
utils.ensureExists(TEMP_FOLDER, initialize);
