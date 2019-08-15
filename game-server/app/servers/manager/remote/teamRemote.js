// 组队服务器
var utils = require('../../../util/utils');
var teamManager = require('../../../services/teamManager');

module.exports = function () {
    return new TeamRemote();
};

var TeamRemote = function () {
};

// 是否一个玩家可以创建一个游戏副本
TeamRemote.prototype.canCreateGameCopy = function (args, cb) {
    var playerId = args.playerId;
    var teamId = args.teamId;

    var result = false;
    var teamObj = teamManager.getTeamById(teamId);
    if (teamObj) {
        result = teamObj.isCaptainById(playerId);
    }

    utils.invokeCallback(cb, null, result);
};

// 创建一个新的队伍
TeamRemote.prototype.createTeam = function (args, cb) {
    var ret = teamManager.createTeam(args);
    utils.invokeCallback(cb, null, ret);
};

// 丢弃一个队伍
TeamRemote.prototype.disbandTeamById = function (args, cb) {
    var playerId = args.playerId;
    var teamId = args.teamId;
    var ret = teamManager.disbandTeamById(playerId, teamId);
    utils.invokeCallback(cb, null, ret);
};

// 离开一个队伍
TeamRemote.prototype.leaveTeamById = function (args, cb) {
    var playerId = args.playerId;
    var teamId = args.teamId;
    teamManager.leaveTeamById(playerId, teamId, cb);
};

// 拖动队伍成员到游戏副本
TeamRemote.prototype.dragMember2gameCopy = function (args, cb) {
    teamManager.dragMember2gameCopy(args, cb);
};

// 申请人应邀加入队伍
TeamRemote.prototype.applyJoinTeam = function (args, cb) {
    utils.myPrint('ApplyJoinTeam is running ... args = ', JSON.stringify(args));
    var ret = teamManager.applyJoinTeam(args);
    utils.invokeCallback(cb, null, ret);
};

// 接受申请人加入队伍
TeamRemote.prototype.acceptApplicantJoinTeam = function (args, cb) {
    var ret = teamManager.acceptApplicantJoinTeam(args);
    utils.invokeCallback(cb, null, ret);
};

// 队长邀请玩家加入队伍
TeamRemote.prototype.inviteJoinTeam = function (args, cb) {
    var ret = teamManager.inviteJoinTeam(args);
    utils.invokeCallback(cb, null, ret);
};

// 接受队长邀请加入队伍
TeamRemote.prototype.acceptInviteJoinTeam = function (args, cb) {
    var ret = teamManager.acceptInviteJoinTeam(args);
    utils.invokeCallback(cb, null, ret);
};

// 更新队伍的成员信息
TeamRemote.prototype.updateMemberInfo = function (args, cb) {
    var ret = teamManager.updateMemberInfo(args);
    utils.invokeCallback(cb, null, ret);
};

// 队伍内的聊天
TeamRemote.prototype.chatInTeam = function (args, cb) {
    var ret = teamManager.chatInTeam(args);
    utils.invokeCallback(cb, null, ret);
};

// 离开队伍
TeamRemote.prototype.kickOut = function (args, cb) {
    teamManager.kickOut(args, cb);
};