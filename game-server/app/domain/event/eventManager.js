var EntityType = require('../../consts/consts').EntityType;
var pomelo = require('pomelo');
var npcEvent = require('./npcEvent');
var characterEvent = require('./characterEvent');
var playerEvent = require('./playerEvent');

var exp = module.exports;

/**
 * Listen event for entity
 */
exp.addEvent = function(entity){
	switch(entity.type){
		case EntityType.PLAYER :
			playerEvent.addEventForPlayer(entity);
			characterEvent.addEventForCharacter(entity);
			addSaveEvent(entity);
			break;
		case EntityType.MOB :
			characterEvent.addEventForCharacter(entity);
			break;
		case EntityType.NPC :
			npcEvent.addEventForNPC(entity);
			break;
	}
};

/**
 * Add save event for player
 * @param {Object} player The player to add save event for.
 */
//通过同步工具，回写相关信息到数据库.
//pomelo-sync 的模块提供了exec方法，当函数收到save事件后，执行exec，将操作行为放到数据库队列里，每隔一段时间执行
function addSaveEvent(player) {
	var app = pomelo.app;
	player.on('save', function() {
		app.get('sync').exec('playerSync.updatePlayer', player.id, player.strip());
	});

	player.bag.on('save', function() {
		app.get('sync').exec('bagSync.updateBag', player.bag.id, player.bag);
	});

	player.equipments.on('save', function() {
		app.get('sync').exec('equipmentsSync.updateEquipments', player.equipments.id, player.equipments);
	});
}

