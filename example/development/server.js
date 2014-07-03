var http = require('http'),
	cluster = require('cluster');

if(!cluster.isWorker) return;

var server = http.createServer(function(req, res) {
	res.writeHead(200);
	res.end([
		'<!DOCTYPE HTML>',
		'<html>',
			'<head>',
				'<title>RackMan Example</title>',
			'</head>',
			'<body>',
				'<h1>RackMan Server Demo</h1>',
				'<p>Hosted on <strong>Port ' + process.env.port + '</strong></p>',
				'<p>Worker ID ' + cluster.worker.id + '</p>',
				'<p>Process ID ' + process.pid + '</p>',
				'<p>Rendered at ' + new Date().toString() + '</p>',
				'<p>',
					'Take note that when accessing this page directly,',
					'your browser may keep your connection active (Keep-Alive)',
					'which will have the effect of preventing this worker from',
					'closing until the connection times out (default 120 seconds).',
					'<br>',
					'We recommend you run RackMan behind a load balancer like NGNIX',
					'to avoid this problem, as your browser will Keep-Alive to NGINX',
					'instead of to the specific worker process.',
				'</p>',
			'</body>',
		'</html>',
		''].join('\n'));
}).listen(process.env.port);