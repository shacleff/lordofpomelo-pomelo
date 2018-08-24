var http = require('http');
var port = 3006;
var timeout = 100000;
var epasswd = 'mylord';
var qs = require('querystring');
var fs = require('fs');
var path = require('path');
var mimeTypes = {
  "html": "text/html",
  "jpeg": "image/jpeg",
  "jpg": "image/jpeg",
  "png": "image/png",
  "js": "text/javascript",
  "css": "text/css"
};

module.exports = function (app, opts) {
  return new HttpDebug(app, opts);
};

var HttpDebug = function (app, opts) {
  this.app = app;
  this.name = '__httpdebug__';
  this.userDicPath = null;
  this.opts = opts;
};

var server = null;

HttpDebug.prototype.start = function (cb) {
};

// http server关闭
var httpStop = function () {
  server.close(function () {
    console.log(' http server stop port ' + port);
    server = null;
  });
}

// http server开启
var httpStart = function () {

  // 创建一个http server
  server = http.createServer(function (req, res) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });

    if (req.method === "GET") {

      var url = require('url').parse(req.url, true);
      var html = '<html><body><form action="/do" id="ddd"  method="post" >passwd:<input type="password" name="passwd" id="passwd"><br/>script:<textarea id="script" name="script" style="width:80%;height:50%"></textarea><br/><input  type="submit" value=" go "  text=go><br/><form></body></html>'
      return res.end(html);
    }
    else if (req.method == 'POST') {

      // 数据初始化
      var body = '';

      // 收到数据不断累计
      req.on('data', function (data) {
        body += data;
      });

      // 得到最终数据
      req.on('end', function () {
        var params = qs.parse(body);
        if (params.passwd !== epasswd) {
          res.writeHead(403, "forbid", { 'Content-Type': 'text/html' });
          return res.end('wrong passwd');
        }
        var result = 'ok'
        try {
          result = eval(params.script);
        } catch (ex) {
          result = ex.stack;
        }
        res.writeHead(200, "OK", { 'Content-Type': 'text/html' });
        return res.end(JSON.stringify(result));
      });
    }
  })

  // 
  server.listen(port);

  // 
  server.addListener("connection", function (socket) {
    socket.setTimeout(timeout);
  });

  // 
  console.log('Http server start at port ' + port);
}

process.on('SIGUSR1', function () {

  // 
  if (server === null) {
    httpStart();
  }
  // 
  else {
    httpStop();
  }
  
});

