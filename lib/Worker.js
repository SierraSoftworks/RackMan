var cluster = require('cluster'),
	colors = require('colors');

module.exports = Worker;

function Worker(port, config, hooks) {
	this.port = port;
	this.config = config;
	this.hooks = hooks;
	this.active = true;
};

Worker.prototype = {
	get environment() {
		if(!this.config.environment) return { port: this.port };
		var env = {};
		for(var k in this.config.environment)
			env[k] = this.config.environment[k];
		env.port = this.port;

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
		console.log('Worker %d Now Listening on Port %d'.green, worker.id, this.port);
		worker.status = 'Listening';
		worker.started = true;
		worker.restart = true;
		this.hooks.workerUp(this);
	}).bind(this));

	worker.once('disconnect', (function() {
		//console.log('Worker %d Now Disconnecting'.grey, worker.id);
		worker.state = 'Disconnecting';
		if(worker.started) {
			this.hooks.workerDown(this);
			console.log("Worker %d Has Shutdown".blue, worker.id);
		}
		else {
			this.hooks.workerCrashed(this);
			console.error("Worker %d Failed To Start Successfully".red, worker.id);
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
		console.warn("Worker %d Shutdown Timeout Expired - Killing".yellow, worker.id);
		try {
			worker.kill('SIGHUP');
		} catch(ex) {
			console.error("Failed To Kill Worker %d".red, worker.id);
			return;
		}
	}).bind(this), this.config.timeout);

	worker.once('exit', function() {
		if(shutdownTimer) clearTimeout(shutdownTimer);
	});

	//console.log('Shutting Down Worker %d'.blue, worker.id);
	try {
		worker.disconnect();
	} catch(ex) {
		console.error("Failed To Disconnect Worker %d - it has probably crashed".red, worker.id);
		clearTimeout(shutdownTimer);
	}
};