var http = require('http'),
	cluster = require('cluster'),
	template = require('./templates/main.js');

if(!cluster.isWorker) return;

var server = http.createServer(function(req, res) {
	res.writeHead(200);
	res.end(template({
		port: process.env.port,
		worker_id: cluster.worker.id,
		pid: process.pid
	}));
}).listen(process.env.port);