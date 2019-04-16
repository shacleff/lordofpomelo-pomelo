/**
 * 副本服务器-->负责全局管理副本全生命周期 和组队相关操作的服务器
 */
var utils = require('../../../util/utils');
var instanceManager = require('../../../services/instanceManager');
var exp = module.exports;

var logger = require('pomelo-logger').getLogger(__filename);

exp.create = function(params, cb){
  logger.error('create server params : %j', params);
  instanceManager.getInstance(params, function(err, result){
    if(err){
      logger.error('create instance error! args : %j, err : %j', params, err);
      utils.invokeCallback(cb, err);
    }else{
      utils.invokeCallback(cb, null, result);
    }
  });
};

exp.remove = function(id, cb){
  instanceManager.remove(id);

  utils.invokeCallback(cb, null, id);
};



