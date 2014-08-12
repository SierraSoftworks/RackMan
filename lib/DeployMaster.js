var path = require('path'),
	cluster = require('cluster'),
	fs = require('fs');

var Config = require('./Config'),
	Hooks = require('./Hooks');

module.exports = function(master) {
	var fixedVersion = master.version;
	if(master.version === true && !updateVersion(master)) return master.onError(new Error('Unable to read version from .rackversion'));

	master.config = Config(path.resolve(master.project, master.version));
	if(!master.config) return master.onError(new Error("Missing .rackman.json configuration file"));

	master.hooks = new Hooks(master.project);

	cluster.setupMaster({
		exec: path.resolve(master.project, master.version, master.config.server)
	});

	if(fixedVersion === true) master.monitor.watch('.rack.json', function() {
		updateVersion(master);
		cluster.settings.exec = path.resolve(master.project, master.version, master.config.server);
		master.hooks = new Hooks(master.project);
		master.onNewConfig(Config(path.resolve(master.project, master.version)));
		master.hooks.clusterChanged('.rack.json');
		master.emit('modified', '.rack.json', 'change');
	});

	master.onReady();
};

function updateVersion(master) {
	try {
		var file = fs.readFileSync(path.resolve(master.project, '.rack.json'), { encoding: 'utf-8' });
		var config = JSON.parse(file);
		var newVersion = config.head;
		if(newVersion == master.version) return false;
		master.version = newVersion;
		return true;
	} catch(ex) {
		return false;
	}
}