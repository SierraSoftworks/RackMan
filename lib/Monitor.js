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
	
	this.watching = false;
	this.bindings = {};

	this.on('error', function(err) {
		console.error("Failed to watch directories\n%s".red, err.stack || err.message);
	});
}

util.inherits(Monitor, EventEmitter);

Monitor.prototype.init = function() {
	if(this.watching) return;
	watch.watchTree(this.base, {
		ignoreDirectoryPattern: /(^\..*)|(node_modules)/
	}, (function(file, curr, prev) {
		if(typeof file == 'object' && !prev && !curr) return;
		var type = 'changed';
		file = path.relative(self.base, file);

		Object.keys(this.bindings).forEach((function(pattern) {
			if(!pattern.match(file)) return;
			if(!prev) type = 'created';

			else if (curr.nlink === 0) type = 'removed';

			this.emit('all', type, file);
			onChange.poke(type, file);
		}).bind(this));
	}).bind(this));
	this.watching = true;
};

Monitor.prototype.watch = function(pattern, callback) {
	var self = this;
	var glob = new Minimatch(pattern);

	var onChange = this.bindings[glob] = new Limit(1000, callback);

	this.init();
};

Monitor.prototype.unwatch = function(watch) {
	
};

Monitor.prototype.close = function() {
	watch.unwatchTree(this.base);
};