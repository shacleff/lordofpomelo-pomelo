var dataApi = require('../../util/dataApi');
var MobZone = require('./../map/mobzone');
var NPC = require('./../entity/npc');
var pomelo = require('pomelo');
var ai = require('../../ai/ai');
var patrol = require('../../patrol/patrol');
var ActionManager = require('./../action/actionManager');
var aoiManager = require('pomelo-aoi');
var eventManager = require('./../event/eventManager');
var aoiEventManager = require('./../aoi/aoiEventManager');
var EntityType = require('../../consts/consts').EntityType;
var utils = require('../../util/utils');
var Timer = require('./timer');
var logger = require('pomelo-logger').getLogger(__filename);
var channelUtil = require('../../util/channelUtil');

/**
 * Init areas
 * @param {Object} opts
 * @api public
 */
var Instance = function(opts){
  this.areaId = opts.id;
  this.type = opts.type;
  this.map = opts.map;

  //The map from player to entity
  this.players = {};   //玩家
  this.users = {};
  this.entities = {};  //实体
  this.zones = {};     //地区
  this.items = {};     //物品
  this.channel = null;

  this.playerNum = 0;
  this.emptyTime = Date.now();
  //Init AOI
  this.aoi = aoiManager.getService(opts);

  this.aiManager = ai.createManager({area:this});         //怪物ai 工厂方法
  this.patrolManager = patrol.createManager({area:this}); //patrol 巡逻工厂方法
  this.actionManager = new ActionManager();               //action  动作工厂方法

  this.timer = new Timer({
    area : this,
    interval : 100
  });

  this.start();
};

module.exports = Instance;

/**
 * @api public
 */
Instance.prototype.start = function() {
  aoiEventManager.addEvent(this, this.aoi.aoi);  //aoi监听事件

  //Init mob zones
  this.initMobZones(this.map.getMobZones());     //初始化怪物空间
  this.initNPCs();                               //初始化NPC

    //AI管理服务启动
    //初始化AI行为，读取game-server/app/api/brain/目录下的ai行为文件，利用提供pomelo-bt行为树来控制ai的策略，
    //通过aiManager注册brain。当用户利用addEntity添加实例的时候，将ai行为添加到该实体
  this.aiManager.start();

    //地图设计器，定时执行地图内的处理信息任务
    //执行地图的tick，轮训地图内的变量，当变量有变化的时候，通知客户端
  this.timer.run();
};

Instance.prototype.close = function(){
  this.timer.close();
};

/**
 * Init npcs
 * @api private
 */
//读取game-server/config/data/npc.json生成npc人物
Instance.prototype.initNPCs = function() {
  var npcs = this.map.getNPCs();

  for(var i = 0; i < npcs.length; i++) {
    var data = npcs[i];

    data.kindId = data.id;
    var npcInfo = dataApi.npc.findById(data.kindId);
    data.kindName = npcInfo.name;
    data.englishName = npcInfo.englishName;
    data.kindType = npcInfo.kindType;
    data.orientation = data.orientation;
    data.areaId = this.id;

    this.addEntity(new NPC(data));
  }
};

Instance.prototype.getChannel = function() {
  if(!this.channel){
    var channelName = channelUtil.getAreaChannelName(this.areaId);
    utils.myPrint('channelName = ', channelName);
    this.channel = pomelo.app.get('channelService').getChannel(channelName, true);
  }

  utils.myPrint('this.channel = ', this.channel);
  return this.channel;
};

/**
 * Init all zones in area
 * @api private
 */
//读取相对目录./map/mobzone.js文件，初始化MobZone，通过读取game-server/config/data/character.js on文件来初始化
Instance.prototype.initMobZones = function(mobZones) {
  for(var i = 0; i < mobZones.length; i++) {
    var opts = mobZones[i];
    opts.area = this;
    var zone = new MobZone(opts);
    this.zones[zone.zoneId] = zone;
  }
};

/**
 * Add entity to area
 * @param {Object} e Entity to add to the area.
 */
//添加实体对象更新
Instance.prototype.addEntity = function(e) {
  var entities = this.entities;
  var players = this.players;
  var users = this.users;

  if(!e || !e.entityId) {
    return false;
  }

  if(!!players[e.id]) {
    logger.error('add player twice! player : %j', e);
    return false;
  }

  //Set area and areaId
  e.area = this;

  entities[e.entityId] = e;
  eventManager.addEvent(e);

  if(e.type === EntityType.PLAYER) {
    this.getChannel().add(e.userId, e.serverId);
    this.aiManager.addCharacters([e]);

    this.aoi.addWatcher({id: e.entityId, type: e.type}, {x : e.x, y: e.y}, e.range);
    players[e.id] = e.entityId;
    users[e.userId] = e.id;

    this.playerNum++;
    utils.myPrint('e = ', JSON.stringify(e));
    utils.myPrint('e.teamId = ', JSON.stringify(e.teamId));
    utils.myPrint('e.isCaptain = ', JSON.stringify(e.isCaptain));
  }else if(e.type === EntityType.MOB) {
    this.aiManager.addCharacters([e]);

    this.aoi.addWatcher({id: e.entityId, type: e.type}, {x : e.x, y: e.y}, e.range);
  }else if(e.type === EntityType.ITEM) {
    this.items[e.entityId] = e.entityId;
  }else if(e.type === EntityType.EQUIPMENT) {
    this.items[e.entityId] = e.entityId;
  }

  this.aoi.addObject({id:e.entityId, type:e.type}, {x: e.x, y: e.y});
  return true;
};

/**
 * Remove Entity form area
 * @param {Number} entityId The entityId to remove
 * @return {boolean} remove result
 */
Instance.prototype.removeEntity = function(entityId) {
  var zones = this.zones;
  var entities = this.entities;
  var players = this.players;
  var users = this.users;
  var items = this.items;

  var e = entities[entityId];
  if(!e) return true;

  //If the entity belong to a subzone, remove it
  if(!!zones[e.zoneId]) {
    zones[e.zoneId].remove(entityId);
  }

  //If the entity is a player, remove it
  if(e.type === 'player') {
    this.getChannel().leave(e.userId, pomelo.app.getServerId());
    this.aiManager.removeCharacter(e.entityId);
    this.patrolManager.removeCharacter(e.entityId);
    this.aoi.removeObject({id:e.entityId, type: e.type}, {x: e.x, y: e.y});
    this.actionManager.abortAllAction(entityId);

    e.forEachEnemy(function(enemy) {
      enemy.forgetHater(e.entityId);
    });

    e.forEachHater(function(hater) {
      hater.forgetEnemy(e.entityId);
    });

    this.aoi.removeWatcher(e, {x : e.x, y: e.y}, e.range);
    delete players[e.id];
    delete users[e.userId];

    this.playerNum--;

    if(this.playerNum === 0){
      this.emptyTime = Date.now();
    }
    delete entities[entityId];
  }else if(e.type === 'mob') {
    this.aiManager.removeCharacter(e.entityId);
    this.patrolManager.removeCharacter(e.entityId);
    this.aoi.removeObject({id: e.entityId, type: e.type}, {x: e.x, y: e.y});
    this.actionManager.abortAllAction(entityId);

    e.forEachEnemy(function(enemy) {
      enemy.forgetHater(e.entityId);
    });

    e.forEachHater(function(hater) {
      hater.forgetEnemy(e.entityId);
    });

    this.aoi.removeWatcher(e, {x : e.x, y: e.y}, e.range);
    delete entities[entityId];
  }else if(e.type === EntityType.ITEM || e.type === EntityType.EQUIPMENT) {
    delete items[entityId];
    this.aoi.removeObject({id: e.entityId, type: e.type}, {x: e.x, y: e.y});
    delete entities[entityId];
  }

  // this.aoi.removeObject(e, {x: e.x, y: e.y});
  // delete entities[entityId];
  return true;
};

/**
 * Get entity from area
 * @param {Number} entityId.
 */
Instance.prototype.getEntity = function(entityId) {
  var entity = this.entities[entityId];
  if (!entity) {
    return null;
  }
  return entity;
};

/**
 * Get entities by given id list
 * @param {Array} The given entities' list.
 * @return {Map} The entities
 */
Instance.prototype.getEntities = function(ids) {
  var result = {};

  result.length = 0;
  for(var i = 0; i < ids.length; i++) {
    var entity = this.entities[ids[i]];
    if(!!entity) {
      if(!result[entity.type]){
        result[entity.type] = [];
      }

      result[entity.type].push(entity);
      result.length++;
    }
  }

  return result;
};

Instance.prototype.getAllPlayers = function() {
  var _players = [];
  for(var id in this.players) {
    _players.push(this.entities[this.players[id]]);
  }

  return _players;
};

Instance.prototype.getAllEntities = function() {
  return this.entities;
};

Instance.prototype.getPlayer = function(playerId) {
  var entityId = this.players[playerId];

  if(!!entityId) {
    return this.entities[entityId];
  }

  return null;
};

Instance.prototype.removePlayer = function(playerId) {
  var entityId = this.players[playerId];

  if(!!entityId) {
    this.removeEntity(entityId);
  }
};

Instance.prototype.removePlayerByUid = function(uid){
  var users = this.users;
  var playerId = users[uid];

  if(!!playerId){
    delete users[uid];
    this.removePlayer(playerId);
  }
};

/**
 * Get area entities for given postion and range.
 * @param {Object} pos Given position, like {10,20}.
 * @param {Number} range The range of the view, is the circle radius.
 */
Instance.prototype.getAreaInfo = function(pos, range) {
  var ids = this.aoi.getIdsByPos(pos, range);
  return this.getEntities(ids);
};

/**
 * Get entities from area by given pos, types and range.
 * @param {Object} pos Given position, like {10,20}.
 * @param {Array} types The types of the object need to find.
 * @param {Number} range The range of the view, is the circle radius.
 */
Instance.prototype.getEntitiesByPos = function(pos, types, range) {
  var entities = this.entities;
  var idsMap = this.aoi.getIdsByRange(pos, range, types);
  var result = {};
  for(var type in idsMap) {
    if(type === 'npc' || type === 'item') continue;
    if(!result[type]) {
      result[type] = [];
    }
    for(var i = 0; i < idsMap[type].length; i++) {
      var id = idsMap[type][i];
      if(!!entities[id]) {
        result[type].push(entities[id]);
      }else{
        logger.error('AOI data error ! type : %j, id : %j', type, id);
      }
    }
  }
  return result;
};

Instance.prototype.isEmpty = function(){
  return this.playerNum === 0;
};
