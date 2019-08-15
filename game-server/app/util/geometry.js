var logger = require('pomelo-logger').getLogger(__filename);

var exp = module.exports;

// 点是否在多边形中
exp.isInPolygon = function (pos, polygon) {
    var p = {x: 10000000, y: pos.y};
    var count = 0;

    for (var i = 0; i < polygon.length; i++) {
        var p1 = polygon[i];
        var p2 = polygon[(i + 1) % polygon.length];

        if (this.isOnline(pos, p1, p2)) {
            return true;
        }

        if (p1.y !== p2.y) {
            if (this.isOnline(p1, pos, p)) {
                if (p1.y > p2.y) {
                    count++;
                    continue;
                }
            } else if (this.isOnline(p2, pos, p)) {
                if (p2.y > p1.y) {
                    count++;
                    continue;
                }
            } else if (this.isIntersect(pos, p, p1, p2)) {
                count++;
                continue;
            }
        }
    }

    if (count % 2 === 1) {
        return true;
    }

    return false;
};

// 是否点在线上
exp.isOnline = function (pos, p1, p2) {
    var v1 = {x: pos.x - p1.x, y: pos.y - p1.y};
    var v2 = {x: p2.x - p1.x, y: p2.y - p1.y};

    if ((v1.x * v2.y - v2.x * v1.y) === 0) {
        if (pos.y >= Math.min(p1.y, p2.y) && pos.y <= Math.max(p1.y, p2.y) &&
            pos.x >= Math.min(p1.x, p2.x) && pos.x <= Math.max(p1.x, p2.x)) {
            return true;
        }

        return false;
    }

    return false;
};

// 测试是否2条线相交
exp.isIntersect = function (p1, p2, q1, q2) {
    if (!this.isRectIntersect(p1, p2, q1, q2)) {
        return false;
    }

    var v1 = {x: (p1.x - q1.x), y: (p1.y - q1.y)};
    var v2 = {x: (q2.x - q1.x), y: (q2.y - q1.y)};
    var v3 = {x: (p2.x - q1.x), y: (p2.y - q1.y)};

    if (this.vecCross(v1, v2) * this.vecCross(v2, v3) > 0) {
        return true;
    }

    return false;
};

// 是否2个矩形相交
exp.isRectIntersect = function (p1, p2, q1, q2) {
    var minP = {x: p1.x < p2.x ? p1.x : p2.x, y: p1.y < p2.y ? p1.y : p2.y};
    var maxP = {x: p1.x > p2.x ? p1.x : p2.x, y: p1.y > p2.y ? p1.y : p2.y};
    var minQ = {x: q1.x < q2.x ? q1.x : q2.x, y: q1.y < q2.y ? q1.y : q2.y};
    var maxQ = {x: q1.x > q2.x ? q1.x : q2.x, y: q1.y > q2.y ? q1.y : q2.y};


    var minx = Math.max(minP.x, minQ.x);
    var miny = Math.max(minP.y, minQ.y);
    var maxx = Math.min(maxP.x, maxQ.x);
    var maxy = Math.min(maxP.y, maxQ.y);

    return !(minx > maxx || miny > maxy);
};

exp.vecCross = function (v1, v2) {
    return v1.x * v2.y - v2.x * v1.y;
};