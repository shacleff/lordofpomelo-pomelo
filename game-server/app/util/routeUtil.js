var exp = module.exports;

// 地图服务器
exp.area = function (session, msg, app, cb) {
    var serverId = session.get('serverId');

    if (!serverId) {
        cb(new Error('can not find server info for type: ' + msg.serverType));
        return;
    }

    cb(null, serverId);
};

// 连接服务器
exp.connector = function (session, msg, app, cb) {
    if (!session) {
        cb(new Error('fail to route to connector server for session is empty'));
        return;
    }

    if (!session.frontendId) {
        cb(new Error('fail to find frontend id in session'));
        return;
    }

    cb(null, session.frontendId);
};
