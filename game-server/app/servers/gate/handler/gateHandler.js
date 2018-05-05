var Code = require('../../../../../shared/code');
var dispatcher = require('../../../util/dispatcher');

/**
 * Gate handler that dispatch user to connectors.
 */
module.exports = function(app) {
	return new Handler(app);
};

var Handler = function(app) {
	this.app = app;
};

//客户端发送uid到pomelo的gate服务器上，执行服务器函数gate.gateHandler.queryEntry
Handler.prototype.queryEntry = function(msg, session, next) {
	var uid = msg.uid;
	if(!uid) {
		next(null, {code: Code.FAIL});
		return;
	}

	//分配其中一台connector为用户服务，返回该connector服务器对应的ip和端口，客户端收到消息后断开与gate服务器连接
	//，并获得connector服务器的ip和端口。
	var connectors = this.app.getServersByType('connector');
	if(!connectors || connectors.length === 0) {
		next(null, {code: Code.GATE.FA_NO_SERVER_AVAILABLE});
		return;
	}

	var res = dispatcher.dispatch(uid, connectors);
	next(null, {code: Code.OK, host: res.host, port: res.clientPort});
  // next(null, {code: Code.OK, host: res.pubHost, port: res.clientPort});
};