var path = require('path'),
	fs = require('fs');

module.exports = Config;

function Config(application) {
	var configPath = path.resolve(process.cwd(), application, '.rackman.json');
	try {
		var configJSON = fs.readFileSync(configPath, { encoding: 'utf-8' });
		return JSON.parse(configJSON);
	} catch(err) {
		console.error("Reading Config File Failed\n%s".red, err.message);
		return null;
	}
}