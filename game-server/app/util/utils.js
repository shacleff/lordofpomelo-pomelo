/**
 * 打印日志等函数
 */
var utils = module.exports;
var isPrintFlag = true; // 是否打印日志

utils.invokeCallback = function (cb) { // 检查参数，调用函数
  if (!!cb && typeof cb === 'function') {
    cb.apply(null, Array.prototype.slice.call(arguments, 1));
  }
};

utils.clone = function (origin) { // 克隆一个对象
  if (!origin) {
    return;
  }
  var obj = {};
  for (var f in origin) {
    if (origin.hasOwnProperty(f)) {
      obj[f] = origin[f];
    }
  }
  return obj;
};

utils.size = function (obj) { // 对象属性个数
  if (!obj) {
    return 0;
  }
  var size = 0;
  for (var f in obj) {
    if (obj.hasOwnProperty(f)) {
      size++;
    }
  }
  return size;
};

function getStack() { // 文件名和行号
  var orig = Error.prepareStackTrace;
  Error.prepareStackTrace = function (_, stack) {
    return stack;
  };
  var err = new Error();
  Error.captureStackTrace(err, arguments.callee);
  var stack = err.stack;
  Error.prepareStackTrace = orig;
  return stack;
}

function getFileName(stack) {
  return stack[1].getFileName();
}

function getLineNumber(stack) {
  return stack[1].getLineNumber();
}

utils.myPrint = function () { // 列行等信息也打印出来
  if (isPrintFlag) {
    var len = arguments.length;
    if (len <= 0) {
      return;
    }
    var stack = getStack();
    var aimStr = '\'' + getFileName(stack) + '\' @' + getLineNumber(stack) + ' :\n';
    for (var i = 0; i < len; ++i) {
      aimStr += arguments[i] + ' ';
    }
    console.log('\n' + aimStr);
  }
};

