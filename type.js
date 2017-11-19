function def(sourceClass, extendedProperties, opts) {
  function extendedType() {
    if (typeof this["constructor"] === "function") this["constructor"].apply(this, arguments);
  }

  extendedType.super = sourceClass;
  extendedType.signature = extendedProperties;
  var wovedProps = wove(extendedType, extendedProperties);
  extendedType.prototype = Object.assign({}, sourceClass.prototype, wovedProps);
  return extendedType;
}

function wove(target, props){
  var woved = Object.assign({}, props);
  for (var key in woved) {
    if(woved[key] instanceof Array && isValidArraySignature(woved[key])) {
      woved[key] = createProxyFn(target, key, woved[key]);
    }
  }
  return woved;
}

function createProxyFn(target, key, adviceList) {
  var adviceIndex = -1;
  return function() {

    function commitNext() {
      adviceIndex++;
      if (adviceList[adviceIndex]) {
        if (adviceList[adviceIndex].name === "advice") {
          adviceList[adviceIndex](adviceMetadata);
          if (!isAsync(adviceList[adviceIndex])) adviceMetadata.commit();
        } else {
          adviceMetadata.result = adviceList[adviceIndex].apply(adviceMetadata.scope, adviceMetadata.args);
          adviceMetadata.commit();
        }
      }
    }

    var adviceMetadata = {
      args: Array.prototype.slice.call(arguments),
      scope: this,
      key: key,
      method: getProxyMethodBody(adviceList),
      target: target,
      result: undefined,
      commit: commitNext
    };

    commitNext();

    return adviceMetadata.result;
  }
}

function isValidArraySignature(ff) {
  return ff.every(function(fn) { return typeof fn === "function" }) &&
  ff.filter(function(fn) { return !fn.name }).length === 1;
}

function getProxyMethodBody(adviceList) {
  return adviceList.find(function(fn) { return !fn.name });
}

function isAsync(rawAdvice) {
  return !!rawAdvice.toString().match(/[a-zA-Z$_]\.commit/);
}

function advice(fn){
  fn.name = "advice";
  return fn;
}

var override = advice(function(meta) {
  meta.args.unshift(meta.target.super.prototype[meta.key].bind(meta.scope));
});

var inject = function(){
  var providers = Array.prototype.slice.call(arguments);
  return advice(function (meta) {
    if (meta.key !== "constructor") { throw new Error("inject only available in constructor") }
    meta.args = providers.map(function(provider) { return provider() });
  });
}

function createInstance(_type) {
  var object = new _type;
  return object;
}

var factory = function(_type){
  return function () {
    return new _type;
  }
};

var singleton = function (_type) {
  var instance;
  return function () {
    if (!instance) instance = new _type;
    return instance;
  }
};

var clear = function(type){
  for (var key in type.signature) {
    if(type.signature[key] instanceof Array && isValidArraySignature(type.signature[key])) {
      type.prototype[key] = getProxyMethodBody(type.signature[key]);
    }
  }
  return type;
}

// oop
module.exports = function(props) { return def(function() {}, props) };
module.exports.inherits = function(parent, props) { return def(parent, props) };

// advices
module.exports.advice = advice;
module.exports.override = override;
module.exports.inject = inject;

// di
module.exports.factory = factory;
module.exports.singleton = singleton;

// remove ioc
module.exports.clear = clear;