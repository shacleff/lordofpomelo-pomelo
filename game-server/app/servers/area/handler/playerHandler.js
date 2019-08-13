var messageService = require('../../../domain/messageService');
var areaService = require('../../../services/areaService');
var userDao = require('../../../dao/userDao');
var bagDao = require('../../../dao/bagDao');
var equipmentsDao = require('../../../dao/equipmentsDao');
var taskDao = require('../../../dao/taskDao');
var Move = require('../../../domain/action/move');
var actionManager = require('../../../domain/action/actionManager');
var logger = require('pomelo-logger').getLogger(__filename);
var pomelo = require('pomelo');
var consts = require('../../../consts/consts');
var dataApi = require('../../../util/dataApi');
var channelUtil = require('../../../util/channelUtil');
var utils = require('../../../util/utils');

var handler = module.exports;

// 玩家进入地图后的处理,回应playerInfo, areaInfo and mapData 等信息给客户端
handler.enterScene = function (msg, session, next) {
    var area = session.area;
    var playerId = session.get('playerId');
    var areaId = session.get('areaId');
    var teamId = session.get('teamId') || consts.TEAM.TEAM_ID_NONE;
    var isCaptain = session.get('isCaptain');
    var isInTeamInstance = session.get('isInTeamInstance');
    var instanceId = session.get('instanceId');

    userDao.getPlayerAllInfo(playerId, function (err, player) {
        if (err || !player) {
            logger.error('Get user for userDao failed! ' + err.stack);
            next(new Error('fail to get user from dao'), {
                route: msg.route,
                code: consts.MESSAGE.ERR
            });
            return;
        }

        player.serverId = session.frontendId;
        player.teamId = teamId;
        player.isCaptain = isCaptain;
        player.isInTeamInstance = isInTeamInstance;
        player.instanceId = instanceId;
        areaId = player.areaId;
        utils.myPrint("2 ~ GetPlayerAllInfo: player.instanceId = ", player.instanceId);

        pomelo.app.rpc.chat.chatRemote.add(session, session.uid,
            player.name, channelUtil.getAreaChannelName(areaId), null);
        var map = area.map;

        // 位置不可达,则重置位置
        if (!map.isReachable(player.x, player.y)) {
            var pos = map.getBornPoint();
            player.x = pos.x;
            player.y = pos.y;
        }

        var data = {
            entities: area.getAreaInfo({x: player.x, y: player.y}, player.range),
            curPlayer: player.getInfo(),
            map: {
                name: map.name,
                width: map.width,
                height: map.height,
                tileW: map.tileW,
                tileH: map.tileH,
                weightMap: map.collisions
            }
        };

        next(null, data);

        if (!area.addEntity(player)) {
            logger.error("Add player to area faild! areaId : " + player.areaId);
            next(new Error('fail to add user into area'), {
                route: msg.route,
                code: consts.MESSAGE.ERR
            });
            return;
        }

        if (player.teamId > consts.TEAM.TEAM_ID_NONE) {
            // 给管理服务器发送玩家新的信息
            var memberInfo = player.toJSON4TeamMember();
            memberInfo.backendServerId = pomelo.app.getServerId();
            pomelo.app.rpc.manager.teamRemote.updateMemberInfo(session, memberInfo,
                function (err, ret) {

                });
        }
    });
};

// 改变玩家的视图
handler.changeView = function (msg, session, next) {
    var timer = session.area.timer;

    var playerId = session.get('playerId');
    var width = msg.width;
    var height = msg.height;

    var radius = width > height ? width : height;

    var range = Math.ceil(radius / 600);
    var player = session.area.getPlayer(playerId);

    if (range < 0 || !player) {
        next(new Error('invalid range or player'));
        return;
    }

    if (player.range !== range) {
        timer.updateWatcher({id: player.entityId, type: player.type}, player, player, player.range, range);
        player.range = range;
    }

    next();
};

// 玩家请求在地图上移动
handler.move = function (msg, session, next) {
    var area = session.area;
    var timer = area.timer;

    var path = msg.path;
    var playerId = session.get('playerId');
    var player = area.getPlayer(playerId);
    var speed = player.walkSpeed;

    player.target = null;

    if (!area.map.verifyPath(path)) {
        logger.warn('The path is illegal!! The path is: %j', msg.path);
        next(null, {
            route: msg.route,
            code: consts.MESSAGE.ERR
        });
        return;
    }

    var action = new Move({
        entity: player,
        path: path,
        speed: speed
    });

    var ignoreList = {};
    ignoreList[player.userId] = true;
    if (timer.addAction(action)) {
        player.isMoving = true;

        // 更新状态
        if (player.x !== path[0].x || player.y !== path[0].y) {
            timer.updateObject({id: player.entityId, type: consts.EntityType.PLAYER}, {
                x: player.x,
                y: player.y
            }, path[0]);
            timer.updateWatcher({id: player.entityId, type: consts.EntityType.PLAYER}, {
                x: player.x,
                y: player.y
            }, path[0], player.range, player.range);
        }

        messageService.pushMessageByAOI(area, {
            route: 'onMove',
            entityId: player.entityId,
            path: path,
            speed: speed
        }, path[0], ignoreList);

        next(null, {
            route: msg.route,
            code: consts.MESSAGE.RES
        });
    }
    next(null, {});
};

// 丢弃一个装备或者物品
handler.dropItem = function (msg, session, next) {
    var player = session.area.getPlayer(session.get('playerId'));

    player.bag.removeItem(msg.index);

    next(null, {status: true});
};

// 添加一个装备
handler.addItem = function (msg, session, next) {
    var player = session.area.getPlayer(session.get('playerId'));
    var bagIndex = player.bag.addItem(msg.item);
    next(null, {bagIndex: bagIndex});
};

// 改变地图
handler.changeArea = function (msg, session, next) {
    var playerId = session.get('playerId');
    var areaId = msg.areaId;
    var target = msg.target;

    if (areaId === target) {
        next(null, {success: false});
        return;
    }

    var player = session.area.getPlayer(playerId);
    if (!player) {
        next(null, {success: false});
        return;
    }

    // 立即保存玩家的数据
    userDao.updatePlayer(player);
    bagDao.update(player.bag);
    equipmentsDao.update(player.equipments);
    taskDao.tasksUpdate(player.curTasks);

    var teamId = player.teamId;
    var isCaptain = player.isCaptain;

    var req = {
        areaId: areaId,
        target: target,
        uid: session.uid,
        playerId: playerId,
        frontendId: session.frontendId
    };

    areaService.changeArea(req, session, function (err) {
        var args = {areaId: areaId, target: target, success: true};
        next(null, args);
    });
};

// 使用一个物品
handler.useItem = function (msg, session, next) {
    var player = session.area.getPlayer(session.get('playerId'));
    var status = player.useItem(msg.index);
    next(null, {code: consts.MESSAGE.RES, status: status});
};

// npc对话
handler.npcTalk = function (msg, session, next) {
    var player = session.area.getPlayer(session.get('playerId'));
    player.target = msg.targetId;
    next();
};

// 玩家捡起一个物品
handler.pickItem = function (msg, session, next) {
    var area = session.area;

    var player = area.getPlayer(session.get('playerId'));
    var target = area.getEntity(msg.targetId);
    if (!player || !target || (target.type !== consts.EntityType.ITEM && target.type !== consts.EntityType.EQUIPMENT)) {
        next(null, {
            route: msg.route,
            code: consts.MESSAGE.ERR
        });
        return;
    }

    player.target = target.entityId;
    next(null, {});
};

// 玩家学习一个技能
handler.learnSkill = function (msg, session, next) {
    var player = session.area.getPlayer(session.get('playerId'));
    var status = player.learnSkill(msg.skillId);
    next(null, {status: status, skill: player.fightSkills[msg.skillId]});
};

// 玩家升级一个技能
handler.upgradeSkill = function (msg, session, next) {
    var player = session.area.getPlayer(session.get('playerId'));
    var status = player.upgradeSkill(msg.skillId);
    next(null, {status: status});
};
