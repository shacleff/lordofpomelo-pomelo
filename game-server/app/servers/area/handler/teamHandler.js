var messageService = require('../../../domain/messageService');
var logger = require('pomelo-logger').getLogger(__filename);
var consts = require('../../../consts/consts');
var utils = require('../../../util/utils');
var dataApi = require('../../../util/dataApi');

module.exports = function (app) {
    return new Handler(app);
};

var Handler = function (app) {
    this.app = app;
    this.teamNameArr = dataApi.team.all();
    this.teamNameArr.length = Object.keys(this.teamNameArr).length;
};

// 玩家创建一个队伍 1:成功 0:失败
Handler.prototype.createTeam = function (msg, session, next) {
    var area = session.area;
    var playerId = session.get('playerId');
    var player = area.getPlayer(playerId);

    if (!player) {
        next();
        return;
    }

    // 玩家在组中，不能创建新的组
    if (player.teamId !== consts.TEAM.TEAM_ID_NONE) {
        next();
        return;
    }

    var tmpIdx = Math.floor((Math.random() * this.teamNameArr.length) + 1);
    var teamName = this.teamNameArr[tmpIdx] ? this.teamNameArr[tmpIdx].teamName : consts.TEAM.DEFAULT_NAME;
    var backendServerId = this.app.getServerId();
    var result = consts.TEAM.JOIN_TEAM_RET_CODE.SYS_ERROR;
    var playerInfo = player.toJSON4TeamMember();
    var args = {
        teamName: teamName,
        playerId: playerId,
        areaId: area.areaId,
        userId: player.userId,
        serverId: player.serverId,
        backendServerId: backendServerId,
        playerInfo: playerInfo
    };

    this.app.rpc.manager.teamRemote.createTeam(session, args,
        function (err, ret) {
            result = ret.result;
            var teamId = ret.teamId;
            if (result === consts.TEAM.JOIN_TEAM_RET_CODE.OK && teamId > consts.TEAM.TEAM_ID_NONE) {
                if (!player.joinTeam(teamId)) {
                    result = consts.TEAM.JOIN_TEAM_RET_CODE.SYS_ERROR;
                }
            }

            if (result === consts.TEAM.JOIN_TEAM_RET_CODE.OK && player.teamId > consts.TEAM.TEAM_ID_NONE) {
                player.isCaptain = consts.TEAM.YES;
                var ignoreList = {};
                messageService.pushMessageByAOI(area,
                    {
                        route: 'onTeamCaptainStatusChange',
                        playerId: playerId,
                        teamId: player.teamId,
                        isCaptain: player.isCaptain,
                        teamName: teamName
                    },
                    {x: player.x, y: player.y},
                    ignoreList
                );
            }

            next();
        });
};

// 队长丢弃队伍,1:成功 0:失败
Handler.prototype.disbandTeam = function (msg, session, next) {
    var area = session.area;
    var playerId = session.get('playerId');
    var player = area.getPlayer(playerId);

    if (!player) {
        logger.warn('The request(disbandTeam) is illegal, the player is null : msg = %j.', msg);
        next();
        return;
    }

    if (player.teamId <= consts.TEAM.TEAM_ID_NONE || msg.teamId !== player.teamId) {
        logger.warn('The request(disbandTeam) is illegal, the teamId is wrong : msg = %j.', msg);
        next();
        return;
    }

    utils.myPrint('playerId, IsInTeamInstance = ', playerId, player.isInTeamInstance);
    if (player.isInTeamInstance) {
        next();
        return;
    }

    if (!player.isCaptain) {
        logger.warn('The request(disbandTeam) is illegal, the player is not the captain : msg = %j.', msg);
        next();
        return;
    }

    var result = consts.TEAM.FAILED;

    var args = {playerId: playerId, teamId: player.teamId};
    this.app.rpc.manager.teamRemote.disbandTeamById(session, args,
        function (err, ret) {
            result = ret.result;
            utils.myPrint("1 ~ result = ", result);
            if (result === consts.TEAM.OK) {
                if (player.isCaptain) {
                    player.isCaptain = consts.TEAM.NO;
                    var ignoreList = {};
                    messageService.pushMessageByAOI(area,
                        {
                            route: 'onTeamCaptainStatusChange',
                            playerId: playerId,
                            teamId: player.teamId,
                            isCaptain: player.isCaptain,
                            teamName: consts.TEAM.DEFAULT_NAME
                        },
                        {x: player.x, y: player.y}, ignoreList);
                }
            }
        });

    next();
};

// 队长邀请成员加入战队,把 邀请 发给被邀请者
Handler.prototype.inviteJoinTeam = function (msg, session, next) {
    var area = session.area;
    var captainId = session.get('playerId');
    var captainObj = area.getPlayer(captainId);

    if (!captainObj) {
        logger.warn('The request(inviteJoinTeam) is illegal, the player is null : msg = %j.', msg);
        next();
        return;
    }

    var inviteeObj = area.getPlayer(msg.inviteeId);
    if (!inviteeObj) {
        logger.warn('The request(inviteJoinTeam) is illegal, the invitee is null : msg = %j.', msg);
        next();
        return;
    }

    // 发送邀请给被邀请者
    var args = {captainId: captainId, teamId: msg.teamId};
    this.app.rpc.manager.teamRemote.inviteJoinTeam(session, args, function (err, ret) {
        var result = ret.result;
        utils.myPrint("result = ", result);
        if (result === consts.TEAM.OK) {
            var captainInfo = captainObj.toJSON4Team();
            messageService.pushMessageToPlayer({uid: inviteeObj.userId, sid: inviteeObj.serverId},
                'onInviteJoinTeam', captainInfo);
        }
    });
    next();
};

// 被邀请者回应邀请者结果,推送信息给队里每个人
Handler.prototype.inviteJoinTeamReply = function (msg, session, next) {
    var area = session.area;
    var inviteeId = session.get('playerId');
    var inviteeObj = area.getPlayer(inviteeId);

    if (!inviteeObj) {
        logger.warn('The request(inviteJoinTeamReply) is illegal, the player is null : msg = %j.', msg);
        next();
        return;
    }

    var captainObj = area.getPlayer(msg.captainId);
    if (!captainObj) {
        logger.warn('The request(inviteJoinTeamReply) is illegal, the captain is null : msg = %j.', msg);
        next();
        return;
    }

    if (msg.teamId !== captainObj.teamId) {
        logger.warn('The request(inviteJoinTeamReply) is illegal, the teamId is wrong : msg = %j.', msg);
        next();
        return;
    }

    var result = consts.TEAM.JOIN_TEAM_RET_CODE.SYS_ERROR;
    var backendServerId = this.app.getServerId();
    if (msg.reply === consts.TEAM.JOIN_TEAM_REPLY.ACCEPT) {
        var inviteeInfo = inviteeObj.toJSON4TeamMember();
        var args = {
            captainId: msg.captainId, teamId: msg.teamId,
            playerId: inviteeId, areaId: area.areaId, userId: inviteeObj.userId,
            serverId: inviteeObj.serverId, backendServerId: backendServerId,
            playerInfo: inviteeInfo
        };
        this.app.rpc.manager.teamRemote.acceptInviteJoinTeam(session, args, function (err, ret) {
            utils.myPrint('AcceptInviteJoinTeam ~ ret = ', JSON.stringify(ret));
            result = ret.result;
            if (result === consts.TEAM.JOIN_TEAM_RET_CODE.OK) {
                if (!inviteeObj.joinTeam(msg.teamId)) {
                    result = consts.TEAM.JOIN_TEAM_RET_CODE.SYS_ERROR;
                    messageService.pushMessageToPlayer({uid: captainObj.userId, sid: captainObj.serverId},
                        'onInviteJoinTeamReply', {reply: result});
                } else {
                    inviteeObj.isCaptain = consts.TEAM.NO;
                    var ignoreList = {};
                    messageService.pushMessageByAOI(area,
                        {
                            route: 'onTeamMemberStatusChange',
                            playerId: inviteeId,
                            teamId: inviteeObj.teamId,
                            isCaptain: inviteeObj.isCaptain,
                            teamName: ret.teamName
                        },
                        {x: inviteeObj.x, y: inviteeObj.y}, ignoreList);
                }
                utils.myPrint('invitee teamId = ', inviteeObj.teamId);
            } else {
                messageService.pushMessageToPlayer({uid: captainObj.userId, sid: captainObj.serverId},
                    'onInviteJoinTeamReply', {reply: result});
            }
        });
    } else {
        // push msg to the inviter(the captain) that the invitee reject to join the team
        messageService.pushMessageToPlayer({uid: captainObj.userId, sid: captainObj.serverId},
            'onInviteJoinTeamReply', {reply: result});
    }
    next();
};

// 申请人加入队伍, 推送给队长通知
Handler.prototype.applyJoinTeam = function (msg, session, next) {
    utils.myPrint('ApplyJoinTeam ~ msg = ', JSON.stringify(msg));
    var area = session.area;
    var applicantId = session.get('playerId');
    var applicantObj = area.getPlayer(applicantId);

    if (!applicantObj) {
        logger.warn('The request(applyJoinTeam) is illegal, the player is null : msg = %j.', msg);
        next();
        return;
    }

    if (applicantObj.isInTeam()) {
        next();
        return;
    }

    var captainObj = area.getPlayer(msg.captainId);
    if (!captainObj) {
        logger.warn('The request(applyJoinTeam) is illegal, the captain is null : msg = %j.', msg);
        next();
        return;
    }

    if (captainObj.teamId !== msg.teamId) {
        logger.warn('The request(applyJoinTeam) is illegal, the teamId is wrong : msg = %j.', msg);
        next();
        return;
    }

    // 发送通知给队长
    var args = {applicantId: applicantId, teamId: msg.teamId};
    this.app.rpc.manager.teamRemote.applyJoinTeam(session, args, function (err, ret) {
        var result = ret.result;
        if (result === consts.TEAM.OK) {
            var applicantInfo = applicantObj.toJSON4Team();
            messageService.pushMessageToPlayer({uid: captainObj.userId, sid: captainObj.serverId},
                'onApplyJoinTeam', applicantInfo);
        }
    });
    next();
};

// 队长回复应用,推送信息给队内成员, 或者拒绝的应用
Handler.prototype.applyJoinTeamReply = function (msg, session, next) {
    var area = session.area;
    var playerId = session.get('playerId');
    var player = area.getPlayer(playerId);

    if (!player) {
        logger.warn('The request(applyJoinTeamReply) is illegal, the player is null : msg = %j.', msg);
        next();
        return;
    }

    if (!player.isCaptain || player.teamId !== msg.teamId) {
        logger.warn('The request(applyJoinTeamReply) is illegal, the teamId is wrong : msg = %j.', msg);
        next();
        return;
    }

    var applicantObj = area.getPlayer(msg.applicantId);
    if (!applicantObj) {
        logger.warn('The request(applyJoinTeamReply) is illegal, the applicantObj is null : msg = %j.', msg);
        next();
        return;
    }

    if (applicantObj.isInTeam()) {
        next();
        return;
    }

    if (msg.reply === consts.TEAM.JOIN_TEAM_REPLY.ACCEPT) {
        var result = consts.TEAM.JOIN_TEAM_RET_CODE.SYS_ERROR;
        var applicantInfo = applicantObj.toJSON4TeamMember();
        var backendServerId = this.app.getServerId();
        var args = {
            captainId: playerId, teamId: msg.teamId,
            playerId: msg.applicantId, areaId: area.areaId, userId: applicantObj.userId,
            serverId: applicantObj.serverId, backendServerId: backendServerId,
            playerInfo: applicantInfo
        };

        this.app.rpc.manager.teamRemote.acceptApplicantJoinTeam(session, args, function (err, ret) {
            result = ret.result;
            if (result === consts.TEAM.JOIN_TEAM_RET_CODE.OK) {
                if (!applicantObj.joinTeam(msg.teamId)) {
                    result = consts.TEAM.JOIN_TEAM_RET_CODE.SYS_ERROR;
                    messageService.pushMessageToPlayer({uid: applicantObj.userId, sid: applicantObj.serverId},
                        'onApplyJoinTeamReply', {reply: result});
                } else {
                    applicantObj.isCaptain = consts.TEAM.NO;
                    var ignoreList = {};
                    messageService.pushMessageByAOI(area,
                        {
                            route: 'onTeamMemberStatusChange',
                            playerId: msg.applicantId,
                            teamId: applicantObj.teamId,
                            isCaptain: applicantObj.isCaptain,
                            teamName: ret.teamName
                        },
                        {x: applicantObj.x, y: applicantObj.y}, ignoreList);
                }
            } else {
                messageService.pushMessageToPlayer({uid: applicantObj.userId, sid: applicantObj.serverId},
                    'onApplyJoinTeamReply', {reply: ret.result});
            }
        });
    } else {
        // 推送队长拒绝的信息
        messageService.pushMessageToPlayer({uid: applicantObj.userId, sid: applicantObj.serverId},
            'onApplyJoinTeamReply', {reply: consts.TEAM.JOIN_TEAM_REPLY.REJECT});
    }
    next();
};

// 队长踢掉一个成员,推送信息给被踢掉的成员 或 其它成员
Handler.prototype.kickOut = function (msg, session, next) {
    var area = session.area;
    var captainId = session.get('playerId');
    var captainObj = area.getPlayer(captainId);

    if (!captainObj) {
        logger.warn('The request(kickOut) is illegal, the captainObj is null : msg = %j.', msg);
        next();
        return;
    }

    if (captainId === msg.kickedPlayerId) {
        logger.warn('The request(kickOut) is illegal, the kickedPlayerId is captainId : msg = %j.', msg);
        next();
        return;
    }

    if (captainObj.teamId <= consts.TEAM.TEAM_ID_NONE || msg.teamId !== captainObj.teamId) {
        logger.warn('The request(kickOut) is illegal, the teamId is wrong : msg = %j.', msg);
        next();
        return;
    }

    utils.myPrint('captainId, IsInTeamInstance = ', captainId, captainObj.isInTeamInstance);
    if (captainObj.isInTeamInstance) {
        next();
        return;
    }

    var args = {captainId: captainId, teamId: msg.teamId, kickedPlayerId: msg.kickedPlayerId};
    this.app.rpc.manager.teamRemote.kickOut(session, args,
        function (err, ret) {
        });
    next();
};

// 成员自愿离开队伍,推送信息给其它成员
Handler.prototype.leaveTeam = function (msg, session, next) {
    var area = session.area;
    var playerId = session.get('playerId');
    var player = area.getPlayer(playerId);

    if (!player) {
        logger.warn('The request(leaveTeam) is illegal, the player is null: msg = %j.', msg);
        next();
        return;
    }

    if (player.isInTeamInstance) {
        next();
        return;
    }

    var result = consts.TEAM.FAILED;

    if (player.teamId <= consts.TEAM.TEAM_ID_NONE || player.teamId !== msg.teamId) {
        logger.warn('The request(leaveTeam) is illegal, the teamId is wrong: msg = %j.', msg);
        next();
        return;
    }

    var args = {playerId: playerId, teamId: player.teamId};
    this.app.rpc.manager.teamRemote.leaveTeamById(session, args,
        function (err, ret) {
            result = ret.result;
            utils.myPrint("1 ~ result = ", result);
            if (result === consts.TEAM.OK && !player.leaveTeam()) {
                result = consts.TEAM.FAILED;
            }
            if (result === consts.TEAM.OK) {
                var route = 'onTeamMemberStatusChange';
                if (player.isCaptain) {
                    route = 'onTeamCaptainStatusChange';
                    player.isCaptain = consts.TEAM.NO;
                }
                var ignoreList = {};
                messageService.pushMessageByAOI(area,
                    {
                        route: route,
                        playerId: playerId,
                        teamId: player.teamId,
                        isCaptain: player.isCaptain,
                        teamName: consts.TEAM.DEFAULT_NAME
                    },
                    {x: player.x, y: player.y}, ignoreList);
            }
        });

    next();
};
