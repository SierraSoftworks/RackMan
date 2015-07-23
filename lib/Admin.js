var path = require('path'),
	fs = require('fs'),
	crypto = require('crypto'),
	ncp = require('ncp').ncp,
	rm = require('rimraf');

module.exports = Admin;

function Admin(project) {
	this.project = path.resolve(process.cwd(), project);
	this.filter = gitFilter;

	this.config = {};
	try {
		this.config = JSON.parse(fs.readFileSync(path.resolve(project, '.rack.json'), { encoding: 'utf-8' }));
	} catch(ex) {
		this.config = false;
	}
}

Admin.isProject = function(project) {
	try {
		fs.statSync(path.resolve(process.cwd(), project, '.rack.json'));
		return true;
	} catch(ex) {
		return false;
	}
};

Admin.prototype = {
	get valid() {
		return !!this.config;
	}
};

Admin.prototype.save = function(callback) {
	fs.stat(this.project, (function(err) {
		if(err) return fs.mkdir(this.project, (function(err) {
			if(err) return callback(err);
			return fs.writeFile(path.resolve(this.project, '.rack.json'), JSON.stringify(this.config, null, 2), { encoding: 'utf-8' }, callback);
		}).bind(this));

		return fs.writeFile(path.resolve(this.project, '.rack.json'), JSON.stringify(this.config, null, 2), { encoding: 'utf-8' }, callback);
	}).bind(this));
};

Admin.prototype.setup = function(options, callback) {
	if(this.config) return callback(new Error("This rack has already been configured for deployment"));
	this.config = options;
	this.config.head = this.config.head || false;
	this.config.versions = this.config.versions || [];

	return this.save(callback);
};

Admin.prototype.register = function (version, callback) {
	if(!this.config) return callback(new Error("This project hasn't yet been configured for deployment, run rackadmin setup"));

	if (!callback) {
		callback = version;
		version = null;
	}

	if(!version) return callback(new Error("You failed to specify a version to register"));

	fs.stat(path.resolve(this.project, version),(function (err, stat) {
		if (!stat) return callback(new Error("There is no deployed project with the version number " + version));
		this.config.versions.push(version);

		this.save(function (err) {
			if (err) return callback(err);
			return callback(null, version);
		});
	}).bind(this));
};

Admin.prototype.deploy = function(source, version, callback) {
	if(!this.config) return callback(new Error("This project hasn't yet been configured for deployment, run rackadmin setup"));

	if(!callback) {
		callback = version;
		version = null;
	}

	if(!version)
		version = crypto.randomBytes(16).toString('hex');

	fs.stat(path.resolve(this.project, version), (function(err, stat) {
		if(stat) return this.checkout(version, callback);

		ncp(source, path.resolve(this.project, version), {
			filter: this.filter
		}, (function(err) {
			if(err) return callback(err);
			this.config.versions.push(version);
			this.checkout(version, callback);
		}).bind(this));
	}).bind(this));
};

Admin.prototype.checkout = function(version, callback) {
	var oldVersion = this.config.head
	var newVersion = version;

	if(newVersion[0] == '#') {
		var absIndex = parseInt(newVersion.substr(1));
		if(absIndex < 0 || this.config.versions.length <= absIndex)
			return callback(new Error(version + " does not yield a valid deployment index value"));
		newVersion = this.config.versions[absIndex];
	} else if(newVersion[0] == '^') {
		var relativeIndex = parseInt(newVersion.substr(1));
		var currentIndex = this.config.versions.indexOf(this.config.head);
		if(!~currentIndex) return callback(new Error("Cannot use relative indexing when HEAD is not present in the deployment registry"));
		var absIndex = currentIndex - relativeIndex;
		if(absIndex < 0 || this.config.versions.length <= absIndex)
			return callback(new Error(version + " does not yield a valid deployment index value"));
		newVersion = this.config.versions[absIndex];
	}

	fs.stat(path.resolve(this.project, newVersion), (function(err, stat) {
		if(err) return callback(new Error("Couldn't find the target version, " + newVersion));
		if(!stat.isDirectory) return callback(new Error("Target version should be a valid directory"));

		var newVersionConfig;
		try {
			newVersionConfig = require(path.resolve(this.project, newVersion, '.rackman.json'));
		} catch (err) {
			return callback(new Error("Failed to read RackMan configuration file for version being deployed. It may not be a valid RackMan version."));
		}

		this.config.head = newVersion;
		this.save((function(err) {
			if(err) {
				this.config.head = oldVersion;
				return callback(err);
			}

			if (this.config.resources) {
				var targetLink = path.resolve(this.project, this.config.resourceLink || this.config.resources);
				if (targetLink == path.resolve(this.project)) targetLink = path.resolve(this.project, 'currentResources');
				return linkSafe(
					path.resolve(this.project, newVersion, newVersionConfig.resources || this.config.resources),
					targetLink,
					function (err) {
						if (err) return callback(err);
						return callback(null, newVersion);
					});
			}
			else return callback(null, newVersion);
		}).bind(this));
	}).bind(this));
};

Admin.prototype.clean = function(version, callback) {
	if(!callback) {
		callback = version;
		version = null;
	}

	if (version) {
		var absIndex;
		if(version[0] == '#') {
			absIndex = parseInt(version.substr(1));
			if(absIndex < 0 || this.config.versions.length <= absIndex)
				return callback(new Error(version + " does not yield a valid deployment index value"));
			version = this.config.versions[absIndex];
		} else if(version[0] == '^') {
			var relativeIndex = parseInt(version.substr(1));
			var currentIndex = this.config.versions.indexOf(this.config.head);
			if(!~currentIndex) return callback(new Error("Cannot use relative indexing when HEAD is not present in the deployment registry"));
			absIndex = currentIndex - relativeIndex;
			if(absIndex < 0 || this.config.versions.length <= absIndex)
				return callback(new Error(version + " does not yield a valid deployment index value"));
			version = this.config.versions[absIndex];
		}

		var index = this.config.versions.indexOf(version);
		var oldVersions = this.config.versions.slice(0, index);

		if(~oldVersions.indexOf(this.config.head))
			return callback(new Error("Cannot clean as the current deployment is within the selected range"));

		this.config.versions = this.config.versions.slice(index);

		this.save((function(err) {
			if(err) return callback(err);
			return this.cleanOrphanedDeployments(callback);
		}).bind(this));
	} else return this.cleanOrphanedDeployments(callback);
};

Admin.prototype.cleanOrphanedDeployments = function (callback) {
	fs.readdir(this.project, (function (err, files) {
		var removed = [];
		// Remove all directories which don't appear in this.config.versions
		var next = (function (err) {
			if (err) return callback(err);
			if (!files.length) return callback(null, removed);

			var file = files.pop();

			// Don't remove the rack definition file
			if (file == '.rack.json') return next();

			// Don't remove the resources link
			var resourcesLink = this.config.resourcesLink || this.config.resources;
			if (file == resourcesLink) return next();

			// Don't remove versions in the version list
			if (~this.config.versions.indexOf(file)) return next();

			rm(path.resolve(this.project, file), (function (err) {
				if (err) return callback(err);
				removed.push(file);
				return next();
			}).bind(this));
		}).bind(this);

		return next();
	}).bind(this));
};

function gitFilter(filename) {
	return !/\.git/.test(filename);
}

function linkSafe(source, target, callback) {
	fs.lstat(target, function(err, stat) {
		if(stat) return fs.unlink(target, function(err) {
			if(err) return callback(err);
			fs.symlink(source, target, callback);
		});
		fs.symlink(source, target, callback);
	});
}