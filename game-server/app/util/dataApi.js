var area = require('../../config/data/area');
var character = require('../../config/data/character');
var equipment = require('../../config/data/equipment');
var experience = require('../../config/data/experience');
var npc = require('../../config/data/npc');
var role = require('../../config/data/role');
var talk = require('../../config/data/talk');
var item = require('../../config/data/item');
var fightskill = require('../../config/data/fightskill');
var task = require('../../config/data/task');
var team = require('../../config/data/team');

var Data = function (data) {
    var fields = {};
    data[1].forEach(function (i, k) {
        fields[i] = k;
    });
    data.splice(0, 2);

    var result = {}, item;
    data.forEach(function (k) {
        item = mapData(fields, k);
        result[item.id] = item;
    });

    this.data = result;
};

// 数组数据-->对象
var mapData = function (fields, item) {
    var obj = {};
    for (var k in fields) {
        obj[k] = item[fields[k]];
    }
    return obj;
};

// 通过属性找到items
Data.prototype.findBy = function (attr, value) {
    var result = [];
    var i, item;
    for (i in this.data) {
        item = this.data[i];
        if (item[attr] == value) {
            result.push(item);
        }
    }
    return result;
};

Data.prototype.findBigger = function (attr, value) {
    var result = [];
    value = Number(value);
    var i, item;
    for (i in this.data) {
        item = this.data[i];
        if (Number(item[attr]) >= value) {
            result.push(item);
        }
    }
    return result;
};

Data.prototype.findSmaller = function (attr, value) {
    var result = [];
    value = Number(value);
    var i, item;
    for (i in this.data) {
        item = this.data[i];
        if (Number(item[attr]) <= value) {
            result.push(item);
        }
    }
    return result;
};

// 通过id找到item
Data.prototype.findById = function (id) {
    return this.data[id];
};

// 所有的item
Data.prototype.all = function () {
    return this.data;
};

module.exports = {
    area: new Data(area),
    character: new Data(character),
    equipment: new Data(equipment),
    experience: new Data(experience),
    npc: new Data(npc),
    role: new Data(role),
    talk: new Data(talk),
    item: new Data(item),
    fightskill: new Data(fightskill),
    task: new Data(task),
    team: new Data(team)
};
