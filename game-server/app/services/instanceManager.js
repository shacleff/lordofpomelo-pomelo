/**
 * 副本管理
 */
var pomelo = require('pomelo');
var utils = require('../util/utils');
var dataApi = require('../util/dataApi');
var consts = require('../consts/consts');
var logger = require('pomelo-logger').getLogger(__filename);
var INSTANCE_SERVER = 'area';

var instances = {}; // 实例map， key:服务器实例instanceId  value: serverId

var instanceServers = []; // 所有的服务器实例

var exp = module.exports;
exp.addServers = function (servers) {
    for (var i = 0; i < servers.length; i++) {
        var server = servers[i];
        if (server.serverType === 'area' && server.instance) {
            instanceServers.push(server);
        }
    }
};

exp.removeServers = function (servers) {
    for (var i = 0; i < servers.length; i++) {
        var server = servers[i];
        if (server.serverType === 'area' && server.instance) {
            exp.removeServer(server.id);
        }
    }
    logger.info('remove servers : %j', servers);
};

exp.getInstance = function (args, cb) {
    var instanceId = args.areaId + '_' + args.id; // instance的key
    if (instances[instanceId]) { // 实例存在，则返回
        utils.invokeCallback(cb, null, instances[instanceId]);
        return;
    }

    var app = pomelo.app; // 不仅可以通过参数传递，这样直接require进来的直接用也可以取到全局app对像
    var serverId = getServerId(); // 得到一个服务id

    var params = { // rpc服务器调用
        namespace: 'user',
        service: 'areaRemote',
        method: 'create',
        args: [{
            areaId: args.areaId,
            instanceId: instanceId
        }]
    };

    app.rpcInvoke(serverId, params, function (err, result) {
        if (!!err) {
            console.error('create instance error!');
            utils.invokeCallback(cb, err);
            return;
        }
        instances[instanceId] = {
            instanceId: instanceId,
            serverId: serverId
        };
        utils.invokeCallback(cb, null, instances[instanceId]);
    });

};

exp.remove = function (instanceId) {
    if (instances[instanceId]) delete instances[instanceId];
};

var count = 0;

function getServerId() { // 返回实例的id
    if (count >= instanceServers.length) {
        count = 0;
    }
    var server = instanceServers[count];
    count++;
    return server.id;
}

function filter(req) {
    var playerId = req.playerId;
    return true;
}

exp.removeServer = function (id) {
    for (var i = 0; i < instanceServers.length; i++) {
        if (instanceServers[i].id === id) {
            delete instanceServers[i];
        }
    }
};
