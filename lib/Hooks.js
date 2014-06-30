var path = require('path');

module.exports = Hooks;

function Hooks(application) {
	this.hooks = {};

	try {
		var hooksFile = require.resolve(path.resolve(process.cwd(), application, '.rackhooks.js'));
		delete require.cache[hooksFile];
		this.hooks = require(hooksFile);
	} catch(ex) {
		console.error("Failed to load .rackhooks.js: %s".red, ex.message);
		this.hooks = {};
	}
}

Hooks.prototype.clusterUp = function() {
	if(this.hooks.cluster && this.hooks.cluster.started)
		try { this.hooks.cluster.started(); } 
		catch(e) { console.error("Error in clusterStarted hook: %s", e.message); }
};

Hooks.prototype.clusterDown = function() {
	if(this.hooks.cluster && this.hooks.cluster.shutdown)
		try { this.hooks.cluster.shutdown(); } 
		catch(e) { console.error("Error in clusterShutdown hook: %s", e.message); }
};

Hooks.prototype.clusterReloading = function() {
	if(this.hooks.cluster && this.hooks.cluster.reloading)
		try { this.hooks.cluster.reloading(); } 
		catch(e) { console.error("Error in clusterReloading hook: %s", e.message); }
};

Hooks.prototype.clusterChanged = function(filename) {
	if(this.hooks.cluster && this.hooks.cluster.changed)
		try { this.hooks.cluster.changed(filename); } 
		catch(e) { console.error("Error in clusterChanged hook: %s", e.message); }
};

Hooks.prototype.workerUp = function(worker) {
	if(this.hooks.worker && this.hooks.worker.started)
		try { this.hooks.worker.started(worker.port); } 
		catch(e) { console.error("Error in workerStarted hook: %s", e.message); }
};

Hooks.prototype.workerDown = function(worker) {
	if(this.hooks.worker && this.hooks.worker.shutdown)
		try { this.hooks.worker.shutdown(worker.port); } 
		catch(e) { console.error("Error in workerShutdown hook: %s", e.message); }
};

Hooks.prototype.workerCrashed = function(worker) {
	if(this.hooks.worker && this.hooks.worker.crashed)
		try { this.hooks.worker.crashed(worker.port); } 
		catch(e) { console.error("Error in workerCrashed hook: %s", e.message); }
};