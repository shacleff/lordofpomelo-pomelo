var dataApi = require('../util/dataApi');
var utils = require('../util/utils');
var pomelo = require('pomelo');
var userDao = require('../dao/userDao');
var taskDao = require('../dao/taskDao');
var Map = require('../domain/map/map');
var AreaType = require('../consts/consts').AreaType;
var async = require('async');
var logger = require('pomelo-logger').getLogger(__filename);

var maps = {};
var exp = module.exports;

exp.init = function () {
    var areas = dataApi.area.all();

    // 初始化地图
    for (var key in areas) {
        var area = areas[key];
        area.weightMap = false;
        maps[area.id] = new Map(area);
    }
};

// 得到出生地
exp.getBornPlace = function (sceneId) {
    return maps[sceneId].getBornPlace();
};

// 得到出生点
exp.getBornPoint = function (sceneId) {
    return maps[sceneId].getBornPoint();
};

// 更改地图：玩家从一个区域传送到另外一个区域
exp.changeArea = function (args, session, cb) { // 玩家从地图一个地方传送到另外一个地方
    var app = pomelo.app;
    var area = session.area;
    var uid = args.uid;
    var playerId = args.playerId;
    var target = args.target;
    var player = area.getPlayer(playerId);
    var frontendId = args.frontendId;

    var targetInfo = dataApi.area.findById(target);

    if (targetInfo.type === AreaType.SCENE) {
        area.removePlayer(playerId);
        var pos = this.getBornPoint(target);
        player.areaId = target;
        player.isInTeamInstance = false;
        player.instanceId = 0;
        player.x = pos.x;
        player.y = pos.y;

        userDao.updatePlayer(player, function (err, success) {
            if (err || !success) {
                err = err || 'update player failed!';
                utils.invokeCallback(cb, err);
            } else {
                session.set('areaId', target);
                session.set('serverId', app.get('areaIdMap')[target]);
                session.set('teamId', player.teamId);
                session.set('isCaptain', player.isCaptain);
                session.set('isInTeamInstance', player.isInTeamInstance);
                session.set('instanceId', player.instanceId);
                session.pushAll(function (err) {
                    if (err) {
                        logger.error('Change area for session service failed! error is : %j', err.stack);
                    }
                    utils.invokeCallback(cb, null);
                });
            }
        });
    } else {
        var closure = this;
        async.series([ // 并发执行
                function (callback) {
                    var params = {areaId: args.target};
                    params.id = playerId;

                    if (targetInfo.type === AreaType.TEAM_INSTANCE && player.teamId) {
                        params.id = player.teamId;
                    }

                    player.isInTeamInstance = true;

                    // 虎丘目标实例
                    app.rpc.manager.instanceRemote.create(session, params, function (err, result) {
                        if (err) {
                            logger.error('get Instance error!');
                            callback(err, 'getInstance');
                        } else {
                            session.set('instanceId', result.instanceId);
                            session.set('serverId', result.serverId);
                            session.set('teamId', player.teamId);
                            session.set('isCaptain', player.isCaptain);
                            session.set('isInTeamInstance', player.isInTeamInstance);
                            session.pushAll();
                            player.instanceId = result.instanceId;

                            if (player.isCaptain && player.teamId && targetInfo.type === AreaType.TEAM_INSTANCE) {
                                utils.myPrint('DragMember2gameCopy is running ...');
                                app.rpc.manager.teamRemote.dragMember2gameCopy(null, {
                                        teamId: player.teamId,
                                        target: target
                                    },
                                    function (err, ret) {
                                        if (!!err) {
                                            logger.error(err, ret);
                                        }
                                    });
                            }
                            callback(null);
                        }
                    });
                },
                function (cb) {
                    area.removePlayer(playerId);

                    var pos = closure.getBornPoint(target);
                    player.x = pos.x;
                    player.y = pos.y;

                    userDao.updatePlayer(player, function (err, success) {
                        if (err || !success) {
                            err = err || 'update player failed!';
                            cb(err, 'update');
                        } else {
                            cb(null);
                        }
                    });
                }
            ],
            function (err, result) {
                if (!!err) {
                    utils.invokeCallback(cb, err);
                    logger.warn('change area failed! args: %j', args);
                } else {
                    utils.invokeCallback(cb, null);
                }
            }
        );
    }
};