var path = require('path'),
	fs = require('fs'),
	colors = require('colors'),
	cluster = require('cluster'),
	EventEmitter = require('events').EventEmitter;

var Monitor = require('./Monitor'),
	Limit = require('./Limit'),
	Worker = require('./Worker');

var DevMaster = require('./DevMaster'),
	DeployMaster = require('./DeployMaster');

module.exports = Master;

function Master(project, version) {
	this.project = project;
	this.version = version;

	this.workers = {};
	this.config = {};

	this.monitor = new Monitor(project);
	this.reloader = new Limit(1000, this.doReload.bind(this));
	this.reloadTimout = null;

	if(!version) DevMaster(this);
	else DeployMaster(this);
}

require('util').inherits(Master, EventEmitter);

Master.prototype.doReload = function() {
	this.emit('reloading');
	delete require.cache[require.resolve(cluster.settings.exec)];

	this.hooks && this.hooks.clusterReloading();

	if(this.reloadTimeout) {
		clearTimeout(this.reloadTimeout);
		this.reloadTimeout = null;
	}

	this.forEachWorker(function(worker) {
		worker.restart();
	});

	if(this.config.reload)
		this.reloadTimeout = setTimeout(this.reloader.callback.bind(this), this.config.reload);
};

Master.prototype.onReady = function() {
	this.config.ports.forEach(this.addWorker.bind(this));
};

Master.prototype.onError = function(err) {
	this.emit('error', err);
};

Master.prototype.forEachWorker = function(callback) {
	for(var k in this.workers) callback(this.workers[k], k);
};

Master.prototype.addWorker = function(port) {
	if(!this.workers.hasOwnProperty('' + port))
		return this.workers['' + port] = new Worker(port, this);
	return this.workers['' + port];
};

Master.prototype.addAndStartWorker = function(port) {
	var worker = this.addWorker(port);
	worker.start();
	return worker;
};

Master.prototype.restartWorker = function(port) {
	if(!this.workers.hasOwnProperty('' + port)) return;
	this.workers['' + port].restart();
	return this.workers['' + port];
};

Master.prototype.removeWorker = function(port) {
	if(!this.workers.hasOwnProperty('' + port)) return;
	var worker = this.workers['' + port];
	delete this.workers['' + port];

	worker.active = false;
	worker.shutdown();
	return worker;
};

Master.prototype.addWatch = function(watch) {
	this.monitor.watch(watch, (function(change, filename) {
		this.emit('modified', filename, change);
		this.reloader.poke();
		this.hooks.clusterChanged(filename);
	}).bind(this));
};

Master.prototype.removeWatch = function(watch) {
	this.monitor.unwatch(watch);
};

Master.prototype.onNewConfig = function(newConfig) {
	var changedPorts = arrayDiff(this.config.ports || [], newConfig.ports || []);
	var changedWatches = arrayDiff(this.config.watch || [], newConfig.watch || []);

	var oldConfig = this.config;
	this.config = newConfig;

	changedWatches.added.forEach(this.addWatch.bind(this));
	changedWatches.removed.forEach(this.removeWatch.bind(this));

	changedPorts.same.forEach(this.restartWorker.bind(this));
	changedPorts.added.forEach(this.addAndStartWorker.bind(this));
	changedPorts.removed.forEach(this.removeWorker.bind(this));

	if(oldConfig.reload != this.config.reload) {
		if(this.reloadTimeout) {
			clearTimeout(this.reloadTimeout);
			this.reloadTimeout = null;
		}
		if(this.config.reload) this.reloadTimeout = setTimeout(this.reload.bind(this), this.config.timeout);
	}
};

/**
 * Public API
 */

Master.prototype.start = function() {
	this.forEachWorker(function(worker) {
		worker.start()
	});

	this.hooks.clusterUp();

	if(this.config.reload)
		reloadTimeout = setTimeout(this.reload.bind(this), this.config.reload);

	if(this.config.watch) this.config.watch.forEach(this.addWatch.bind(this));
};

Master.prototype.stop = function(callback) {
	if(this.reloadTimeout) {
		clearTimeout(this.reloadTimeout);
		this.reloadTimeout = null;
	}

	this.monitor.close();

	this.forEachWorker(function(worker) { worker.active = false; });
	cluster.disconnect((function() {
		this.hooks.clusterDown();
		return callback();
	}).bind(this));
};

Master.prototype.reload = function() {
	this.reloader.poke();
};

function arrayDiff(original, updated) {
	var diff = {
		added: [],
		same: [],
		removed: []
	};

	for(var i = 0; i < original.length; i++)
		if(!~updated.indexOf(original[i])) diff.removed.push(original[i]);
		else diff.same.push(original[i]);

	for(var i = 0; i < updated.length; i++)
		if(!~original.indexOf(updated[i])) diff.added.push(updated[i]);

	return diff;
}