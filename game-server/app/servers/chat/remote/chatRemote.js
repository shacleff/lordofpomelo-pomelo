module.exports = function (app) {
    return new ChatRemote(app, app.get('chatService'));
};

var ChatRemote = function (app, chatService) {
    this.app = app;
    this.chatService = chatService;
};

// 玩家加入频道
ChatRemote.prototype.add = function (uid, playerName, channelName, cb) {
    var code = this.chatService.add(uid, playerName, channelName);
    cb(null, code);
};

// 玩家离开频道
ChatRemote.prototype.leave = function (uid, channelName, cb) {
    this.chatService(uid, channelName);
    cb();
};

// 踢掉玩家
ChatRemote.prototype.kick = function (uid, cb) {
    this.chatService.kick(uid);
    cb();
};
