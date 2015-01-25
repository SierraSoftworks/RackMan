var path = require('path'),
	fs = require('fs'),
	_ = require('lodash');

module.exports = Config;

function Config(primary, secondary) {
	var config = loadConfig(path.resolve(primary, '.rackman.json'));

	if(secondary)
		_.defaults(config, loadConfig(path.resolve(secondary, '.rack.json')).config || {});

	return config;
	
}

function loadConfig(file) {
	try {
		var configJSON = fs.readFileSync(file, { encoding: 'utf-8' });
		return JSON.parse(configJSON);
	} catch(err) {
		console.error("Reading Config File Failed\n%s".red, err.message);
		return {};
	}
}