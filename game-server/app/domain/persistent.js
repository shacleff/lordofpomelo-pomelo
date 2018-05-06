/**
 * Module dependencies
 */
var EventEmitter = require('events').EventEmitter;
var util = require('util');

/**
 * Persistent object, it is saved in database
 *
 * @param {Object} opts
 * @api public
 */
var Persistent = function(opts) {
	this.id = opts.id;
	this.type = opts.type;
	EventEmitter.call(this);
};

util.inherits(Persistent, EventEmitter);

module.exports = Persistent;

// Emit the event 'save'
//可持久化对象的基类，所有的子类都可以调用基类的方法，如:equipments装备，executeTask任务,fightskill,
//通过执行基类的方法，向EventEmitter发送事件，监听的事件得到响应后，写入同步数据库缓存队列，每隔一时间
//回写到服务器
Persistent.prototype.save = function() {
	this.emit('save');
};

