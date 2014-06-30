var fs = require('fs'),
	path = require('path'),
	util = require('util');

module.exports = Monitor;

function Monitor(base, hooks) {
	this.hooks = hooks;

	try {
		this.watcher = fs.watch(base, { persistent: false });
	} catch(err) {
		console.error("Failed to watch %s for changes".red, base);
		process.exit(1);
	}
}

Monitor.prototype.watch = function(watch, callback) {
	this.watcher.on('change', (function(type, filename) {
		if(this.isMatch(watch, filename)) return callback(type, filename);
	}).bind(this));
};

Monitor.prototype.isMatch = function(filter, filename) {
	var filterParts = filter.split(path.sep);
	var fileParts = filename.split(path.sep);

	if(filterParts.length > fileParts.length) return false;
	for(var i = 0; i < filterParts.length; i++)
		if(~filterParts[i].indexOf('*') && !(this.preprocessFilter(filterParts[i]).test(fileParts[i]))) return false;
		else if(filterParts[i] != fileParts[i]) return false;
	return true;
};

Monitor.prototype.preprocessFilter = function(filter) {
	var rxs = filter.replace('.', '\\.').replace('*', '.*');
	var rx = new RegExp('^' + rxs + '$');
};