var cluster = require('cluster'),
	path = require('path'),
	colors = require('colors');

var Config = require('./Config'),
	Hooks = require('./Hooks'),
	Monitor = require('./Monitor'),
	Worker = require('./Worker'),
	Limit = require('./Limit');

if(!cluster.isMaster) return;

var config = Config(process.argv[2]);

if(!config) return process.exit(1);

cluster.setupMaster({
	exec: path.resolve(process.cwd(), process.argv[2], config.server),
	silent: false
});

var hooks = new Hooks(process.argv[2]);
var monitor = new Monitor(path.resolve(process.cwd(), process.argv[2]), hooks);
var workers = config.ports.map(function(port) {
	return new Worker(port, config, hooks);
});


var reloadTimeout = null;
var reloader = new Limit(1000, function() {
	delete require.cache[require.resolve(cluster.settings.exec)];
	hooks.clusterReloading();

	if(reloadTimeout) {
		clearTimeout(reloadTimeout);
		reloadTimeout = null;
	}

	workers.forEach(function(worker) {
		worker.restart();
	});

	if(config.reload)
		reloadTimeout = setTimeout(function() { reloader.callback(); }, config.reload);
});

monitor.watch('.rackman.json', function() {
	console.log("Changes to .rackman.json detected".bold);

	var oldConfig = config;

	// Reload the config file
	config = Config(process.argv[2]);

	workers.forEach(function(worker) {
		worker.shutdown();
	});

	workers = config.ports.map(function(port) {
		var worker = new Worker(port, config, hooks);
		worker.start();
		return worker;
	});

	if(oldConfig.reload != config.reload) {
		if(reloadTimeout) {
			clearTimeout(reloadTimeout);
			reloadTimeout = null;
		}
		if(config.reload) reloadTimeout = setTimeout(function() { reloader.callback(); }, config.timeout);
	}

	hooks.clusterChanged('.rackman.json');
});

monitor.watch('.rackhooks.js', function() {
	console.log("Changes to .rackhooks.js detected".bold);

	// Reload the config file
	hooks = new Hooks(process.argv[2]);
	monitor.hooks = hooks;

	workers.forEach(function(worker) {
		worker.hooks = hooks;
	});

	hooks.clusterChanged('.rackhooks.js');
});

console.log('RackMan Cluster Ready'.bold);
console.log("You can reload the server manually using `\033[1mkill -SIGHUP %d\033[0m` or `\033[1mkill -SIGUSR2 %d\033[0m`", process.pid, process.pid);

workers.forEach(function(worker) {
	worker.start()
});

hooks.clusterUp();

if(config.reload)
	reloadTimeout = setTimeout(function() { reloader.callback() }, config.reload);

if(config.watch) config.watch.forEach(function(watch) {
	monitor.watch(watch, function(change, filename) {
		console.log("%s was %sd".cyan, filename, change);
		reloader.poke();
		hooks.clusterChanged(filename);
	});
});

process.on('SIGINT', function() { 
	console.log("RackMan Cluster Terminating".yellow);
	if(reloadTimeout) {
		clearTimeout(reloadTimeout);
		reloadTimeout = null;
	}

	workers.forEach(function(worker) { worker.active = false; });
	cluster.disconnect(function() {
		console.log("All Workers Closed".yellow);
		hooks.clusterDown();
	}); 
});

process.on('SIGHUP', function() { reloader.callback() });
process.on('SIGUSR2', function() { reloader.callback() });