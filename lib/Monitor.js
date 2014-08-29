var watch = require('watch'),
	EventEmitter = require('events').EventEmitter,
	Minimatch = require('minimatch').Minimatch,
	path = require('path'),
	util = require('util');

module.exports = Monitor;

function Monitor(base) {
	var self = this;
	EventEmitter.call(this);
	this.base = base;

	watch.watchTree(base, {
		ignoreDirectoryPattern: /node_modules/
	}, function(file, curr, prev) {
		if(typeof file == 'object' && !prev && !curr) return;
		if(!prev) return self.emit('all', 'created', file);
		if (curr.nlink === 0) return self.emit('all', 'removed', file);
		return self.emit('all', 'changed', file);
	});

	this.bindings = {};

	this.on('error', function(err) {
		console.error("Failed to watch directories\n%s".red, err.stack || err.message);
	});
}

util.inherits(Monitor, EventEmitter);

Monitor.prototype.watch = function(watch, callback) {
	var glob = new Minimatch(watch);
	var binding = (function(e, file) {
		file = path.relative(this.base, file);
		if(glob.match(file)) return callback(e, file);
	}).bind(this);

	this.on('all', binding);

	if(!this.bindings[watch]) this.bindings[watch] = [binding];
	else this.bindings[watch].push(binding);
};

Monitor.prototype.unwatch = function(watch) {
	if(!this.bindings[watch]) return;
	var bindings = this.bindings[watch];
	delete this.bindings[watch];
	for(var i = 0; i < bindings.length; i++)
		this.removeListener('all', bindings[i]);
};

Monitor.prototype.close = function() {
	watch.unwatchTree(this.base);
};