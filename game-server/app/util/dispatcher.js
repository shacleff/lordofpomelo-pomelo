var crc = require('crc');

module.exports.dispatch = function(uid, connectors) {
	var index = Number(uid) % connectors.length; //crc.crc32不行？
	return connectors[index];  
};
