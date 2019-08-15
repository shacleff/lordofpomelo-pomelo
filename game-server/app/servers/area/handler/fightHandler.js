var handler = module.exports;
var consts = require('../../../consts/consts');
var logger = require('pomelo-logger').getLogger(__filename);
var Fightskill = require('../../../util/dataApi').fightskill;
var Code = require('../../../../../shared/code');

// 用户攻击
handler.attack = function (msg, session, next) {
    var player = session.area.getPlayer(session.get('playerId'));
    var target = session.area.getEntity(msg.targetId);

    if (!target || !player || (player.target === target.entityId) || (player.entityId === target.entityId) || target.died) {
        next(null, {});
        return;
    }

    session.area.timer.abortAction('move', player.entityId);
    player.target = target.entityId;

    next(null, {});
};

// 玩家用技能攻击
handler.useSkill = function (msg, session, next) {
    var playerId = msg.playerId;
    var skillId = msg.skillId;
    var player = session.area.getPlayer(msg.playerId);
    var target = session.area.getEntity(player.target);

    // 检测攻击目标合法性
    if (!target || (target.type !== consts.EntityType.PLAYER && target.type !== consts.EntityType.MOB)) {
        next();
        return;
    }

    next();

    player.attack(target, skillId);
};


