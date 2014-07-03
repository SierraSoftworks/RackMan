var path = require('path'),
	fs = require('fs');

module.exports = Config;

function Config(applicationPath) {
	var configPath = path.resolve(applicationPath, '.rackman.json');
	try {
		var configJSON = fs.readFileSync(configPath, { encoding: 'utf-8' });
		return JSON.parse(configJSON);
	} catch(err) {
		console.error("Reading Config File Failed\n%s".red, err.message);
		return null;
	}
}