var Gaze = require('gaze').Gaze,
	Minimatch = require('minimatch').Minimatch,
	path = require('path');

module.exports = Monitor;

function Monitor(base) {
	this.base = base;
	try {
		this.watcher = new Gaze('**', { cwd: base });
	} catch(err) {
		console.error("Failed to watch %s for changes\n%s".red, base, err.stack);
		process.exit(1);
	}

	this.active = {};
}

Monitor.prototype.watch = function(watch, callback) {
	if(this.active[watch]) return;

	this.watcher.add(watch);

	var matcher = new Minimatch(watch);
	this.active[watch] = (function(type, filename) {
		filename = path.relative(this.base, filename);
		if(matcher.match(filename)) return callback(type, filename);
	}).bind(this);

	this.watcher.on('all', this.active[watch]);
};

Monitor.prototype.unwatch = function(watch) {
	if(!this.active[watch]) return;
	this.watcher.removeListener('all', this.active[watch]);
	delete this.active[watch];
};

Monitor.prototype.close = function() {
	this.watcher.close();
};