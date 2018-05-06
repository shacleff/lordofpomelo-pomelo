var TryAndAdjust = require('../node/tryAndAdjust');
var TryAttack = require('../action/tryAttack');
var MoveToTarget = require('../action/moveToTarget');
//var FindNearbyPlayer = require('../action/findNearbyPlayer');
var Patrol = require('../action/patrol');

//以怪物来做案例，初始化了ai的行为树
var bt = require('pomelo-bt');
var Loop = bt.Loop;
var If = bt.If;
var Select = bt.Select;
var consts = require('../../consts/consts');

/**
 * Tiger brain.
 * Attack the target if have any.
 * Find the nearby target if have no target.
 * Begin to patrol if nothing to do.
 */
var Brain = function(blackboard) {
	this.blackboard = blackboard;
	//try attack and move to target action
	var attack = new TryAndAdjust({
		blackboard: blackboard, 
		adjustAction: new MoveToTarget({
			blackboard: blackboard
		}), 
		tryAction: new TryAttack({
			blackboard: blackboard, 
			getSkillId: function(bb) {
				return 1; //normal attack
			}
		})
	});

	//loop attack action
	var checkTarget = function(bb) {
		if(bb.curTarget !== bb.curCharacter.target) {
			// target has change
			bb.curTarget = null;
			return false;
		}

		return !!bb.curTarget;
	};

	var loopAttack = new Loop({
		blackboard: blackboard, 
		child: attack, 
		loopCond: checkTarget
	});

	//if have target then loop attack action
	var haveTarget = function(bb) {
		var character = bb.curCharacter;
		var targetId = character.target;
		var target = bb.area.getEntity(targetId);

		if(!target) {
			// target has disappeared
			character.forgetHater(targetId);
			bb.curTarget = null;
			return false;
		}

		if(target.type === consts.EntityType.PLAYER) {
			bb.curTarget = targetId;
			return true;
		}
		return false;
	};

	//如果有目标，则开始执行持续攻击
	//使用了行为树中的条件节点，当haveTarget的作用是检查角色里面target有没有锁定对象符合条件，则展开loopAttack持续攻击
	var attackIfHaveTarget = new If({
		blackboard: blackboard, 
		cond: haveTarget, 
		action: loopAttack
	});

	//find nearby target action
	//var findTarget = new FindNearbyPlayer({blackboard: blackboard});
	//patrol action
	var patrol = new Patrol({blackboard: blackboard});

	//composite them together
	//怪物的行为策略，select顺序节点，优先选择攻击附近对象，齐次是巡逻，通过行为树的组合，组成了ai
	this.action = new Select({
		blackboard: blackboard
	});

	this.action.addChild(attackIfHaveTarget);
	//this.action.addChild(findTarget);
	this.action.addChild(patrol);
};

var pro = Brain.prototype;

pro.update = function() {
	return this.action.doAction();
};

module.exports.clone = function(opts) {
	return new Brain(opts.blackboard);
};

module.exports.name = 'tiger';
