var handler = module.exports;
var dataApi = require('../../../util/dataApi');

// 收到客户端请求后，装备武器
handler.equip = function (msg, session, next) {
    var player = session.area.getPlayer(session.get('playerId'));
    var status = false;

    var item = player.bag.items[msg.index];
    var bagIndex = -1;
    if (item) {
        var eq = dataApi.equipment.findById(item.id);
        if (!eq || player.level < eq.heroLevel) {
            next(null, {status: false});
            return;
        }

        bagIndex = player.equip(eq.kind, eq.id);
        player.bag.removeItem(msg.index);

        status = true;
    }
    next(null, {status: status, bagIndex: bagIndex});
};

// 根据用户请求，卸载装备
handler.unEquip = function (msg, session, next) {
    var player = session.area.getPlayer(session.get('playerId'));
    var status = false;
    var bagIndex = -1;
    if (msg.putInBag) {
        bagIndex = player.bag.addItem({id: player.equipments.get(msg.type), type: 'equipment'});
        if (bagIndex > 0) {
            player.unEquip(msg.type);
            status = true;
        }
    } else {
        player.unEquip(msg.type);
        status = true;
    }

    next(null, {status: status, bagIndex: bagIndex});
};

