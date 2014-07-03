var colors = require('colors');

module.exports = {
	cluster: {
		started: function() {
			//console.log("HOOK: cluster.started".grey);
		},
		shutdown: function() {
			//console.log("HOOK: cluster.shutdown".grey);
		},
		reloading: function() {
			//console.log("HOOK: cluster.reloading".grey);
		},
		changed: function(filename) {
			//console.log("HOOK: cluster.changed".grey);
		}
	},
	worker: {
		started: function(port) {
			//console.log("HOOK: worker.started".grey);
		},
		shutdown: function(port) {
			//console.log("HOOK: worker.shutdown".grey);
		},
		crashed: function(port) {
			//console.log("HOOK: worker.crashed".grey);
		}
	}
};