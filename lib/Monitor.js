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
	this.bindings = [];

	this.on('error', function(err) {
		console.error("Failed to watch directories\n%s".red, err.stack || err.message);
	});
}

util.inherits(Monitor, EventEmitter);

Monitor.prototype.init = function() {
	if(this.watching) return;
	this.watching = true;
	watch.watchTree(this.base, {
		ignoreDirectoryPattern: /(^\..*)|(node_modules)/
	}, (function(file, curr, prev) {
		if(typeof file == 'object' && !prev && !curr) return;
		
		var type = 'changed';
		if(!prev) type= "created";
		else if (curr.nlink === 0) type = 'removed';

		file = path.relative(this.base, file);

		this.emit('all', type, file);

		this.bindings.forEach(function(entry) {
			if(!entry.pattern.match(file)) return;
			entry.trigger.poke(type, file);
		});
	}).bind(this));
};

Monitor.prototype.watch = function(pattern, callback) {
	var self = this;
	var glob = new Minimatch(pattern);

	this.bindings.push({ pattern: glob, trigger: new Limit(1000, callback) });

	this.init();
};

Monitor.prototype.unwatch = function(watch) {
	
};

Monitor.prototype.close = function() {
	watch.unwatchTree(this.base);
};