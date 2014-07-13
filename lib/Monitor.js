var Gaze = require('gaze').Gaze,
	Minimatch = require('minimatch').Minimatch,
	path = require('path'),
	util = require('util');

module.exports = Monitor;

function Monitor(base) {
	Gaze.call(this);
	this.options.cwd = base;
	this.base = base;

	this.on('error', function(err) {
		console.error("Failed to watch directories\n%s".red, err.stack || err.message);
	});
}

util.inherits(Monitor, Gaze);

Monitor.prototype.watch = function(watch, callback) {
	this.add(watch);

	var glob = new Minimatch(watch);
	this.on('all', (function(e, file) {
		file = path.relative(this.base, file);
		if(glob.match(file)) return callback(e, file);
	}).bind(this));
};

Monitor.prototype.unwatch = function(watch) {
	this.remove(watch);
};