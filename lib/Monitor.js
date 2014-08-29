var watch = require('watch'),
	EventEmitter = require('events').EventEmitter,
	Minimatch = require('minimatch').Minimatch,
	Limit = require('./Limit'),
	path = require('path'),
	util = require('util');

module.exports = Monitor;

function Monitor(base) {
	var self = this;
	EventEmitter.call(this);
	this.base = base;
	
	this.bindings = {};

	this.on('error', function(err) {
		console.error("Failed to watch directories\n%s".red, err.stack || err.message);
	});
}

util.inherits(Monitor, EventEmitter);

Monitor.prototype.watch = function(pattern, callback) {
	var self = this;
	var glob = new Minimatch(pattern);

	var onChange = this.bindings[pattern] = new Limit(1000, callback);

	watch.watchTree(this.base, {
		filter: function(file) {
			return glob.match(file);
		}
	}, function(file, curr, prev) {
		if(typeof file == 'object' && !prev && !curr) return;
		var type = 'changed';
		
		if(!prev) type = 'created';
		else if (curr.nlink === 0) type = 'removed';

		self.emit('all', type, file);
		onChange.poke(type, file);
	});
};

Monitor.prototype.unwatch = function(watch) {
	
};

Monitor.prototype.close = function() {
	watch.unwatchTree(this.base);
};