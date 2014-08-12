var cluster = require('cluster'),
	colors = require('colors');

module.exports = Worker;

function Worker(port, master) {
	this.port = port;
	this.master = master;
	this.active = true;
};

Worker.prototype = {
	get environment() {
		if(!this.master.config.environment) return { port: this.port };
		var env = {};
		for(var k in this.master.config.environment)
			env[k] = this.master.config.environment[k];
		env.port = this.port;

		if(!this.master.config.version)
			env.version = this.master.version;

		return env;
	},

	get status() {
		return this.worker ? this.worker.status : 'Offline';
	}
};

Worker.prototype.start = function() {
	var worker = this.worker = cluster.fork(this.environment);

	//console.log('Worker %d Now Starting'.grey, worker.id);
	worker.started = false;

	worker.once('online', (function() {
		//console.log('Worker %d Now Online'.grey, worker.id);
		worker.status = "Online";
	}).bind(this));

	worker.once('listening', (function() {
		worker.status = 'Listening';
		worker.started = true;
		worker.restart = true;
		this.master.emit('workerStarted', this, worker);
		this.master.hooks.workerUp(this);
	}).bind(this));

	worker.once('disconnect', (function() {
		//console.log('Worker %d Now Disconnecting'.grey, worker.id);
		worker.state = 'Disconnecting';
		if(worker.started) {
			this.master.emit('workerShutdown', this, worker);
			this.master.hooks.workerDown(this);
		}
		else {
			this.master.emit('workerCrashed', this, worker);
			this.master.hooks.workerCrashed(this);
		}

		if(!this.active) return;
		if(!worker.restart) return;

		this.start();
	}).bind(this));

	worker.once('exit', (function(code, signal) {
		//console.log('Worker %d Now Closed'.grey, worker.id);
		worker.status = 'Closed';
	}).bind(this));

	return worker;
};

Worker.prototype.restart = function(worker) {
	var oldWorker = worker || this.worker;
	var newWorker = this.start();


	if(oldWorker) {
		var startedSuccessfully = false;
		newWorker.once('listening', (function() {
			startedSuccessfully = true;
			this.shutdown(oldWorker);
		}).bind(this));
		newWorker.once('exit', (function() {
			if(!startedSuccessfully)
				this.worker = oldWorker;
		}).bind(this));
	}
};

Worker.prototype.shutdown = function(worker) {
	worker = worker || this.worker;

	worker.restart = false;

	var shutdownTimer = setTimeout((function() {
		shutdownTimer = null;
		this.master.emit('workerKilling', this, worker);
		try {
			worker.kill('SIGHUP');
		} catch(ex) {
			this.master.emit('workerCrashed', this, worker);
			return;
		}
	}).bind(this), this.master.config.timeout);

	worker.once('exit', function() {
		if(shutdownTimer) clearTimeout(shutdownTimer);
	});

	//console.log('Shutting Down Worker %d'.blue, worker.id);
	try {
		worker.disconnect();
	} catch(ex) {
		clearTimeout(shutdownTimer);
		this.master.emit('workerCrashed', this, worker);
	}
};