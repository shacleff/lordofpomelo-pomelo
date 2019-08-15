var Code = require('../../../shared/code');
var utils = require('../util/utils');
var dispatcher = require('../util/dispatcher');
var Event = require('../consts/consts').Event;

var ChatService = function (app) {
    this.app = app;
    this.uidMap = {};
    this.nameMap = {};
    this.channelMap = {};
};

module.exports = ChatService;

// 添加玩家到channel
ChatService.prototype.add = function (uid, playerName, channelName) {
    var sid = getSidByUid(uid, this.app);
    if (!sid) {
        return Code.CHAT.FA_UNKNOWN_CONNECTOR;
    }

    if (checkDuplicate(this, uid, channelName)) {
        return Code.OK;
    }

    utils.myPrint('channelName = ', channelName);
    var channel = this.app.get('channelService').getChannel(channelName, true);
    if (!channel) {
        return Code.CHAT.FA_CHANNEL_CREATE;
    }

    channel.add(uid, sid);
    addRecord(this, uid, playerName, sid, channelName);

    return Code.OK;
};

// 玩家离开channel
ChatService.prototype.leave = function (uid, channelName) {
    var record = this.uidMap[uid];
    var channel = this.app.get('channelService').getChannel(channelName, true);

    if (channel && record) {
        channel.leave(uid, record.sid);
    }

    removeRecord(this, uid, channelName);
};

// 把玩家从聊天服务踢出去
ChatService.prototype.kick = function (uid) {
    var channelNames = this.channelMap[uid];
    var record = this.uidMap[uid];

    if (channelNames && record) {
        // 从channel踢出玩家
        var channel;
        for (var name in channelNames) {
            channel = this.app.get('channelService').getChannel(name);
            if (channel) {
                channel.leave(uid, record.sid);
            }
        }
    }

    clearRecords(this, uid);
};

// 通过指定的频道推送信息
ChatService.prototype.pushByChannel = function (channelName, msg, cb) {
    var channel = this.app.get('channelService').getChannel(channelName);
    if (!channel) {
        cb(new Error('channel ' + channelName + ' dose not exist'));
        return;
    }

    channel.pushMessage(Event.chat, msg, cb);
};

// 给指定玩家推送信息
ChatService.prototype.pushByPlayerName = function (playerName, msg, cb) {
    var record = this.nameMap[playerName];
    if (!record) {
        cb(null, Code.CHAT.FA_USER_NOT_ONLINE);
        return;
    }

    this.app.get('channelService').pushMessageByUids(Event.chat, msg, [{uid: record.uid, sid: record.sid}], cb);
};

// 检查玩家是否在频道
var checkDuplicate = function (service, uid, channelName) {
    return !!service.channelMap[uid] && !!service.channelMap[uid][channelName];
};

// 为指定玩家添加记录
var addRecord = function (service, uid, name, sid, channelName) {
    var record = {uid: uid, name: name, sid: sid};
    service.uidMap[uid] = record;
    service.nameMap[name] = record;
    var item = service.channelMap[uid];
    if (!item) {
        item = service.channelMap[uid] = {};
    }
    item[channelName] = 1;
};

// 根据指定的玩家和频道对，移除记录
var removeRecord = function (service, uid, channelName) {
    delete service.channelMap[uid][channelName];
    if (utils.size(service.channelMap[uid])) {
        return;
    }

    // 如果玩家不再任何频道，清空记录
    clearRecords(service, uid);
};

// 清除玩家记录
var clearRecords = function (service, uid) {
    delete service.channelMap[uid];

    var record = service.uidMap[uid];
    if (!record) {
        return;
    }

    delete service.uidMap[uid];
    delete service.nameMap[record.name];
};

// 根据uid获取connector服务器的id
var getSidByUid = function (uid, app) {
    var connector = dispatcher.dispatch(uid, app.getServersByType('connector'));
    if (connector) {
        return connector.id;
    }
    return null;
};