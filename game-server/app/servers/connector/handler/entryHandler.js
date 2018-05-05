var Code = require('../../../../../shared/code');
var userDao = require('../../../dao/userDao');
var async = require('async');
var channelUtil = require('../../../util/channelUtil');
var utils = require('../../../util/utils');
var logger = require('pomelo-logger').getLogger(__filename);

module.exports = function(app) {
	return new Handler(app);
};

var Handler = function(app) {
	this.app = app;

	if(!this.app)
		logger.error(app);
};

var pro = Handler.prototype;

/**
 * New client entry game server. Check token and bind user info into session.
 *
 * @param  {Object}   msg     request message
 * @param  {Object}   session current session object
 * @param  {Function} next    next stemp callback
 * @return {Void}
 */
pro.entry = function(msg, session, next) {

    //将token发送到auth服务器，进行验证，验证没问题，生成session
	var token = msg.token, self = this;

	if(!token) {
		next(new Error('invalid entry request: empty token'), {code: Code.FAIL});
		return;
	}

	var uid, players, player;
	async.waterfall([
		function(cb) {
			// auth token
			self.app.rpc.auth.authRemote.auth(session, token, cb); //验证通过
		}, function(code, user, cb) {
			// query player info by user id
			if(code !== Code.OK) {
				next(null, {code: code});
				return;
			}

			if(!user) {
				next(null, {code: Code.ENTRY.FA_USER_NOT_EXIST});
				return;
			}

			uid = user.id;
			userDao.getPlayersByUid(user.id, cb);  //从数据库读取用户信息
		}, function(res, cb) {
			// generate session and register chat status
			players = res;
			self.app.get('sessionService').kick(uid, cb); //kick掉其它终端登陆的用户
		}, function(cb) {
			session.bind(uid, cb);
		}, function(cb) {
			if(!players || players.length === 0) {
				next(null, {code: Code.OK});
				return;
			}

			player = players[0];

			session.set('serverId', self.app.get('areaIdMap')[player.areaId]); //根据数据库的记录获取玩家在哪个地图服务器，将地图服务器写在session
			session.set('playername', player.name);
			session.set('playerId', player.id);
			session.on('closed', onUserLeave.bind(null, self.app));
			session.pushAll(cb);
		}, function(cb) {
			self.app.rpc.chat.chatRemote.add(session, player.userId, player.name,
				channelUtil.getGlobalChannelName(), cb); //将玩家添加到聊天室
		}
	], function(err) {
		if(err) {
			next(err, {code: Code.FAIL});
			return;
		}

		next(null, {code: Code.OK, player: players ? players[0] : null}); //返回用户信息
	});
};

var onUserLeave = function (app, session, reason) {
	if(!session || !session.uid) {
		return;
	}

	utils.myPrint('1 ~ OnUserLeave is running ...');
	app.rpc.area.playerRemote.playerLeave(session, {playerId: session.get('playerId'), instanceId: session.get('instanceId')}, function(err){
		if(!!err){
			logger.error('user leave error! %j', err);
		}
	});
	app.rpc.chat.chatRemote.kick(session, session.uid, null);
};
