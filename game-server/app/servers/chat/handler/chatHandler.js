/**
 * chat服务器独立于场景，维护所有在线用户的数据。 通过这些数据与connector服务器通讯，来实现玩家之间的即时通讯
 */
var Code = require('../../../../../shared/code');
var SCOPE = { PRI: '279106', AREA: 'F7A900', ALL: 'D41313', TEAM: '0897f7' };
var channelUtil = require('../../../util/channelUtil');
var logger = require('pomelo-logger').getLogger(__filename);
var utils = require('../../../util/utils');
var consts = require('../../../consts/consts');
var pomelo = require('pomelo');

module.exports = function (app) {
  return new ChannelHandler(app, app.get('chatService'));
};

var ChannelHandler = function (app, chatService) {
  this.app = app;
  this.chatService = chatService; // 负责多个uid name channel等的管理
};

function setContent(str) {
  str = str.replace(/<\/?[^>]*>/g, '');
  str = str.replace(/[ | ]*\n/g, '\n');
  return str.replace(/\n[\s| | ]*\r/g, '\n');
}

ChannelHandler.prototype.send = function (msg, session, next) {
  var scope, content, message, channelName, uid, code;
  var playerId = session.get('playerId');
  uid = session.uid;
  scope = msg.scope;
  channelName = getChannelName(msg);
  utils.myPrint('channelName = ', channelName);
  msg.content = setContent(msg.content);
  content = { playerId: playerId, uid: uid, content: msg.content, scope: scope, kind: msg.kind || 0, from: msg.from };
  if (scope !== SCOPE.PRI) {
    if (scope === SCOPE.TEAM) {
      if (msg.teamId > consts.TEAM.AREA_ID_NONE) {
        var args = { teamId: msg.teamId, content: content };
        utils.myPrint('ByChannel ~ args = ', JSON.stringify(args));
        pomelo.app.rpc.manager.teamRemote.chatInTeam(null, args, function (_, res) { // 远程调用队伍内聊天
          code = res.results ? Code.OK : Code.FAIL;
          next(null, { code: code });
        });
      } else {
        next(null, { code: Code.FAIL });
      }
    } else {
      this.chatService.pushByChannel(channelName, content, function (err, res) {
        if (err) {
          logger.error(err.stack);
          code = Code.FAIL;
        } else if (res) {
          code = res;
        } else {
          code = Code.OK;
        }
        next(null, { code: code });
      });
    }
  } else {
    this.chatService.pushByPlayerName(msg.toName, content, function (err, res) {
      if (err) {
        logger.error(err.stack);
        code = Code.FAIL;
      } else if (res) {
        code = res;
      } else {
        code = Code.OK;
      }
      next(null, { code: code });
    });
  }
};

var getChannelName = function (msg) {
  var scope = msg.scope;
  if (scope === SCOPE.AREA) {
    return channelUtil.getAreaChannelName(msg.areaId); // 队伍内聊天
  }
  return channelUtil.getGlobalChannelName(); // 全局聊天
};
