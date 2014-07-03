# RackMan
**A node process controller designed to enable horizontally scalable deployments**

RackMan has been designed to fill the gap between a full-stack cluster toolkit like [amino](https://www.npmjs.org/package/amino) and custom cluster implementations run behind a load balander. The primary objective is to provide many of the advantages of a full stack cluster toolkit while still allowing a load balancer to work effectively for protocols like WebSockets (which are notoriously poorly handled by such load balancers) and permitting zero-downtime updates.

## Features
 - Spectacularly easy to use
 - Uses metadata for configuration, simplifying deployment workflows
 - Built in smart auto-reload on file changes
 - Support for Upstart
 - Powerful hook support
 - Support for side-by-side deployment

## Setup
To configure RackMan to run on your server, all you need to do is run an `npm install -g rackman` and then point RackMan to your application's deployment folder by running `rackman /my/app/folder`.

All configuration parameters for RackMan are set in the `.rackman.json` file within your application's directory, allowing you to easily change configuration options when deploying your application without the need make modifications to your server.

### Example Configuration

#### .rackman.json
```json
{
	"server": "server.js",
	"ports": [3000, 3001, 3002],
	"watch": [
		"server.js",
		"routes/*.js",
		"models"
	],
	"timeout": 60000,
	"reload": 3600000,
	"environment": {
		"DEBUG": "express"
	}
}
```

#### .rackhooks.js
```javascript
module.exports = {
	cluster: {
		started: function() { },
		shutdown: function() { },
		reloading: function() { },
		changed: function(filename) { }
	},
	worker: {
		started: function(port) { },
		shutdown: function(port) { },
		crashed: function(port) { }
	}
};
```

### Configuration Options
 - **server** - The file used to host the server, should run `.listen(process.env.port)`
 - **ports** - An array of ports to listen on, RackMan will ensure there is always a worker listening on each port
 - **watch** - An array of watch directives which will be used to detect changes to your code and reload your application accordingly
 - **timeout** - The amount of time to wait between requesting a worker shutdown and forcing it to be killed, this can help prevent in-flight requests from being dropped while still ensuring that rogue workers aren't left alive.
 - **reload** - The amount of time between forced reloads, useful for preventing memory leaks
 - **environment** - Any environment variables you would like to provide to your worker processes

### Hooks
 - **cluster.started** - Triggered when RackMan is first started up, can be used to report when your server starts
 - **cluster.shutdown** - Triggered when RackMan has closed down all workers in preperation for shutdown
 - **cluster.reloading** - Triggered when RackMan begins a cluster reload either because files have changed or a SIGHUP/SIGUSR2 signal was recieved
 - **cluster.changed** - Triggered whenever a file change is detected, includes the name of the file which was changed
 - **worker.started** - Triggered whenever a worker is successfully started
 - **worker.shutdown** - Triggered whenever a worker is successfully shutdown
 - **worker.crashed** - Triggered whenevr a worker fails to start correctly or closes prematurely

### Important Notes
RackMan makes use of an intelligent file watching system which attempts to aggregate changes to the file system into a single operation, it does this by waiting for a second after the last file operation is detected before triggering a reload of the server. This means that copy operations shouldn't result in the server spamming reloads - making them safe to do without first closing down the server.

There is one important exception to this, and that is modifications to the `.rackman.json` and `.rackhooks.js` files, which will immediately cause RackMan to take action (in the case of `.rackhooks.js` that is to replace all the hooks in the application with the latest ones, while `.rackman.json` will result in new workers being created in case the ports have changed).

RackMan also attempts to intelligently handle worker crashes, if a worker fails to start correctly it will not be restarted until a cluster reload is initiated - this helps prevent the server from continuously attempting to reload a worker when there is something inherently wrong with the code.

## Advantages
The primary advantages of RackMan are its flexibility and simplicity, allowing you to easily use it to deploy a wide variety of clustered web applications with ease while still maintaining maximum compatibility. This allows you to use systems like NGINX to manage load balancing and sticky sessions automatically while RackMan remains responsible for keeping your server up and zero-downtime upgrades of your application.

This makes RackMan compatible, out of the box, with all common WebSocket libraries including [socket.io](http://socket.io) and [primus](https://github.com/primus/primus). It also means that there is less in the way of requests being processed, and the lightweight nature of Node's cluster framework ensures minimal performance penalties are incurred.

In addition to this, we've provided example NGINX configurations and Upstart scripts which you can easily modify - helping to minimize your setup time.

## Side-by-Side Deployment
A major issue with many automated deployment scenarios is being able to quickly rollback versions when an error occurs, as well as the possibility for serving of partially stale files when updating in-place. A good solution to this is to deploy different versions in parallel, but separate, directories and switch the target once everything is in place - this allows you to reliably rollback to a previous version of your application at any time as well as solving many other transient issues.

RackMan is designed to make deploying such systems as easy as possible by integrating support for these deployments out of the box. All you need to do? Drop a `.rackversion` file in your application's deployment directory and deploy all versions to their own self-contained subdirectories.

### Example
Deploying couldn't be easier, all you need to do is have a directory structure like the following and then ensure the contents of `.rackversion` match the name of the version you want to use. Version names can be any valid directory name, so if you want to use Git hashes to match deployments to your commits you can do that too!

 - /web/apps/myapp/
  - v1
   - .rackman.json
   - .rackhooks.js
  - v2
   - .rackman.json
   - .rackhooks.js
  - v3
   - .rackman.json
   - .rackhooks.js
  - .rackversion

## Custom Implementations
As of v2.0 of RackMan, the terminal interface is simply a wrapper around the RackMan core. This allows you to easily create your own deployment wrappers built on top of RackMan. Want a webpage to manage deployments? You can do that!

All you need to do to create your own wrapper is the following...

```javascript
var RackMan = require('rackman');

// For a single folder deployment
var rm = new RackMan('/web/apps/myapp');

// Or for a multi folder deployment using .rackversion
var rm = new RackMan('/web/apps/myapp', true);

// Or if you want to use a specific version and ignore .rackversion
var rm = new RackMan('/web/apps/myapp', 'v2');

// Run start() when you're ready to get going
rm.start();

// And stop() when you're done
rm.stop(function() {
	process.exit(0);
});

// You can also listen to events
rm.on('error', function(err) {
	
});

rm.on('reloading', function() {
	
});

rm.on('modified', function(file, change) {
	
});

rm.on('workerStarted', function(manager, worker) {
	
});

rm.on('workerShutdown', function(manager, worker) {
	
});

rm.on('workerCrashed', function(manager, worker) {
	
});
```