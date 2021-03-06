var pomelo = require('pomelo');
var areaService = require('./app/services/areaService');
var instanceManager = require('./app/services/instanceManager');
var scene = require('./app/domain/area/scene');
var instancePool = require('./app/domain/area/instancePool');
var dataApi = require('./app/util/dataApi');
var routeUtil = require('./app/util/routeUtil');
var playerFilter = require('./app/servers/area/filter/playerFilter');
var ChatService = require('./app/services/chatService');
var sync = require('pomelo-sync-plugin'); // 同步插件
// var masterhaPlugin = require('pomelo-masterha-plugin');

var app = pomelo.createApp();
app.set('name', 'lord of pomelo');

// configure for global
app.configure('production|development', function () {
    app.before(pomelo.filters.toobusy());
    app.enable('systemMonitor');
    require('./app/util/httpServer');

    //var sceneInfo = require('./app/modules/sceneInfo');
    var onlineUser = require('./app/modules/onlineUser');
    if (typeof app.registerAdmin === 'function') {
        //app.registerAdmin(sceneInfo, {app: app});
        app.registerAdmin(onlineUser, { app: app });
    }

    if (app.serverType !== 'master') { // 场景与服务器之间的映射
        var areas = app.get('servers').area;
        var areaIdMap = {};
        for (var id in areas) {
            areaIdMap[areas[id].area] = areas[id].id;
        }
        app.set('areaIdMap', areaIdMap);
    }

    app.set('proxyConfig', { // 使用地方: appUtil-->loadDefaultComponents使用 app.load(pomelo.proxy, app.get('proxyConfig'));
        cacheMsg: true,
        interval: 30,
        lazyConnection: true
        // enableRpcLog: true
    });

    app.set('remoteConfig', { // 使用地方: appUtil-->loadDefaultComponents使用 app.load(pomelo.remote, app.get('remoteConfig'));
        cacheMsg: true,
        interval: 30
    });

    app.route('area', routeUtil.area); // 有多个服务器的路由配置
    app.route('connector', routeUtil.connector);

    app.loadConfig('mysql', app.getBase() + '/../shared/config/mysql.json'); // mysql数据库配置
    app.filter(pomelo.filters.timeout());

    // app.use(masterhaPlugin, { // master服务器高可用配置
    //   zookeeper: {
    // 	server: '127.0.0.1:2181',
    // 	path: '/pomelo/master'
    //   }
    // });
});

app.configure('production|development', 'auth', function () { // 配置授权服务器
    app.set('session', require('./config/session.json')); // 为授权服务器加载session配置
});

// Configure for area server
app.configure('production|development', 'area', function () {
    app.filter(pomelo.filters.serial());
    app.before(playerFilter());

    var server = app.curServer;
    if (server.instance) { // 实例服务器
        instancePool.init(require('./config/instance.json'));
        app.areaManager = instancePool;
    } else { // 场景服务器
        scene.init(dataApi.area.findById(server.area));
        app.areaManager = scene;

        // disable webkit-devtools-agent
        // var areaId = parseInt(server.area);
        // if(areaId === 3) { // area-server-3
        //   require('webkit-devtools-agent');
        //   var express = require('express');
        //   var expressSvr = express.createServer();
        //   expressSvr.use(express.static(__dirname + '/devtools_agent_page'));
        //   var tmpPort = 3270 + areaId - 1;
        //   expressSvr.listen(tmpPort);
        // }
    }

    areaService.init(); // 场景服务初始化
});

app.configure('production|development', 'manager', function () { // 增加和移除manager服务器事件
    var events = pomelo.events;
    app.event.on(events.ADD_SERVERS, instanceManager.addServers);
    app.event.on(events.REMOVE_SERVERS, instanceManager.removeServers);
});

app.configure('production|development', 'area|auth|connector|master', function () { // mysql数据库配置-->可以为多个服务器配置
    var dbclient = require('./app/dao/mysql/mysql').init(app);
    app.set('dbclient', dbclient);
    app.use(sync, { sync: { path: __dirname + '/app/dao/mapping', dbclient: dbclient } }); // 数据同步插件: eventManager中同步数据使用
});

app.configure('production|development', 'connector', function () {
    var dictionary = app.components.__dictionary__;
    var dict = null;
    if (!!dictionary) {
        dict = dictionary.getDict();
    }

    app.set('connectorConfig', {
        connector: pomelo.connectors.hybridconnector,
        heartbeat: 30,
        useDict: true,
        useProtobuf: true,
        handshake: function (msg, cb) {
            cb(null, {});
        }
    });
});

app.configure('production|development', 'gate', function () {
    app.set('connectorConfig', {
        connector: pomelo.connectors.hybridconnector,
        useProtobuf: true
    });
});

app.configure('production|development', 'chat', function () {
    app.set('chatService', new ChatService(app));
});

/**
 * master是默认插件，在app.start后加载，启动master服务
 * master组件会负责启动其它所有服务
 *   1.master服务启动其它所有服务器，在服务器启动完毕后，其中的monitor组件会连到master对应的监听端口上，表明该服务器启动完毕
 *   2.在所有服务器读启动后，master会调用所有服务器上的afterStart接口，来进行启动后的处理工作
 */
app.start();

process.on('uncaughtException', function (err) {
    console.error(' Caught exception: ' + err.stack);
});
