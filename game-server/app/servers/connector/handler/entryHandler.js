var Code = require('../../../../../shared/code');
var userDao = require('../../../dao/userDao');
var async = require('async');
var channelUtil = require('../../../util/channelUtil');
var utils = require('../../../util/utils');
var logger = require('pomelo-logger').getLogger(__filename);

module.exports = function (app) {
    return new Handler(app);
};

var Handler = function (app) {
    this.app = app;

    if (!this.app)
        logger.error(app);
};

var pro = Handler.prototype;

// 新用户进来，检查token，绑定用户信息到session
pro.entry = function (msg, session, next) {
    var token = msg.token, self = this;

    if (!token) {
        next(new Error('invalid entry request: empty token'), {code: Code.FAIL});
        return;
    }

    var uid, players, player;

    async.waterfall([
            function (cb) {
                self.app.rpc.auth.authRemote.auth(session, token, cb); // token授权
            },

            function (code, user, cb) { // 通过userid查询用户信息
                if (code !== Code.OK) {
                    next(null, {code: code});
                    return;
                }

                if (!user) {
                    next(null, {code: Code.ENTRY.FA_USER_NOT_EXIST});
                    return;
                }

                uid = user.id;
                userDao.getPlayersByUid(user.id, cb);
            },

            function (res, cb) { // 生成session，注册聊天状态
                players = res;
                self.app.get('sessionService').kick(uid, cb);
            },

            function (cb) {
                session.bind(uid, cb);
            },

            function (cb) {
                if (!players || players.length === 0) {
                    next(null, {code: Code.OK});
                    return;
                }

                player = players[0];

                session.set('serverId', self.app.get('areaIdMap')[player.areaId]);
                session.set('playername', player.name);
                session.set('playerId', player.id);
                session.on('closed', onUserLeave.bind(null, self.app));
                session.pushAll(cb);
            },

            function (cb) {
                self.app.rpc.chat.chatRemote.add(session, player.userId, player.name,
                    channelUtil.getGlobalChannelName(), cb);
            }
        ],
        function (err) {
            if (err) {
                next(err, {code: Code.FAIL});
                return;
            }

            next(null, {code: Code.OK, player: players ? players[0] : null});
        });
};

// 用户掉线处理
var onUserLeave = function (app, session, reason) {
    if (!session || !session.uid) {
        return;
    }

    // 地图服务器踢掉这个用户
    app.rpc.area.playerRemote.playerLeave(session, {
        playerId: session.get('playerId'),
        instanceId: session.get('instanceId')
    }, function (err) {
        if (!!err) {
            logger.error('user leave error! %j', err);
        }
    });

    // 聊天服务器踢掉这个用户
    app.rpc.chat.chatRemote.kick(session, session.uid, null);
};
