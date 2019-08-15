var utils = require('../../../util/utils');
var userDao = require('../../../dao/userDao');
var bagDao = require('../../../dao/bagDao');
var taskDao = require('../../../dao/taskDao');
var equipmentsDao = require('../../../dao/equipmentsDao');
var consts = require('../../../consts/consts');
var areaService = require('../../../services/areaService');
var pomelo = require('pomelo');
var logger = require('pomelo-logger').getLogger(__filename);
var messageService = require('../../../domain/messageService');

var exp = module.exports;

// 玩家离开地图后，暂存玩家信息到数据库中
exp.playerLeave = function (args, cb) {
    var playerId = args.playerId;
    var area = pomelo.app.areaManager.getArea(args.instanceId);
    var player = area.getPlayer(playerId);

    if (!player) {
        logger.warn('player not in the area ! %j', args);
        return;
    }
    var sceneId = player.areaId;

    if (!player) {
        utils.invokeCallback(cb);
        return;
    }

    var params = {playerId: playerId, teamId: player.teamId};
    pomelo.app.rpc.manager.teamRemote.leaveTeamById(null, params,
        function (err, ret) {
        });

    if (player.hp === 0) {
        player.hp = Math.floor(player.maxHp / 2);
    }

    // 玩家在实例中，移动到那个场景
    if (area.type !== consts.AreaType.SCENE) {
        var pos = areaService.getBornPoint(sceneId);
        player.x = pos.x;
        player.y = pos.y;
    }

    userDao.updatePlayer(player);
    bagDao.update(player.bag);
    equipmentsDao.update(player.equipments);
    taskDao.tasksUpdate(player.curTasks);
    area.removePlayer(playerId);
    area.channel.pushMessage({route: 'onUserLeave', code: consts.MESSAGE.RES, playerId: playerId});
    utils.invokeCallback(cb);
};

// 离开队伍
exp.leaveTeam = function (args, cb) {
    var playerId = args.playerId;
    var area = pomelo.app.areaManager.getArea(args.instanceId);
    var player = area.getPlayer(playerId);

    var err = null;
    if (!player) {
        err = 'Player leave team error(no player in area)!';
        utils.invokeCallback(cb, err);
        return;
    }

    if (!player.leaveTeam()) {
        err = 'Player leave team error!';
        utils.invokeCallback(cb, err);
        return;
    }

    messageService.pushMessageByAOI(area, {
            route: 'onTeamMemberStatusChange',
            playerId: playerId,
            teamId: player.teamId,
            isCaptain: player.isCaptain,
            teamName: consts.TEAM.DEFAULT_NAME
        }, {
            x: player.x,
            y: player.y
        }, {}
    );

    utils.invokeCallback(cb);
};