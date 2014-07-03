var path = require('path'),
	cluster = require('cluster');

var Config = require('./Config'),
	Hooks = require('./Hooks');

module.exports = function(master) {
	master.config = Config(master.project);
	if(!master.config) return master.onError(new Error("Missing .rackman.json configuration file"));

	master.hooks = new Hooks(master.project);

	cluster.setupMaster({
		exec: path.resolve(master.project, master.config.server)
	});

	master.monitor.watch('.rackman.json', function() {
		master.onNewConfig(Config(master.project));
		master.hooks.clusterChanged('.rackman.json');
		master.emit('modified', '.rackman.json', 'change');
	});

	master.monitor.watch('.rackhooks.js', function() {
		master.hooks = new Hooks(path.resolve(master.project, '.rackhooks.js'));
		master.hooks.clusterChanged('.rackhooks.js');
		master.emit('modified', '.rackhooks.js', 'change');
	});

	master.onReady();
};