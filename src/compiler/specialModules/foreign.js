var context = require('../context');
var lexer = require('../../lexer');
var nodes = require('../nodes');
var parser = require('../../parser');
var types = require('../types');

var MathRaw = [
    'func int:abs(int:i) {}',
    'func float:acos(float:i) {}',
    'func float:asin(float:i) {}',
    'func float:atan(float:i) {}',
    'func float:cos(float:i) {}',
    'func float:sin(float:i) {}',
    'func float:tan(float:i) {}',
    'func int:ceil(float:i) {}',
    'func int:floor(float:i) {}',
    'func float:exp(float:i) {}',
    'func float:log(float:i) {}',
    'func float:sqrt(float:i) {}',
    'func float:hypot(float:a, float:b) {}',
    'func float:atan2(float:y, float:x) {}',
    'func float:pow(float:y, float:x) {}',
].join('\n');

function StdlibType(env, name, raw) {
    this._type = '_stdlib';
    this.name = name;

    raw = context(env, parser(lexer(raw)));

    this.equals = function(x) {
        return false;
    };

    this.flatTypeName = this.toString = this.flatTypeName = function() {
        return 'foreign';
    };

    this.hasMember = function(name) {
        return name in raw.nameMap;
    };

    this.getMemberType = function(name) {
        return raw.typeMap[raw.nameMap[name]];
    };

    this.hasMethod = function() {return false;};
    this.isSubscriptable = function() {return false;};
}

function ForeignType(env) {
    this._type = '_foreign';

    this.equals = function(x) {
        return false;
    };

    this.flatTypeName = this.toString = this.flatTypeName = function() {
        return 'foreign';
    };

    this.hasMember = function(name) {
        return true;
    };

    this.getMemberType = function(name) {
        return new CurriedForeignType(env, name, []);
    };

    this.hasMethod = function() {return false;};
    this.isSubscriptable = function() {return false;};

}

function CurriedForeignType(env, funcName, typeChain) {
    this._type = '_foreign_curry';

    this.equals = function(x) {
        return false;
    };

    this.flatTypeName = this.toString = this.flatTypeName = function() {
        return 'foreign';
    };

    this.hasMember = function(name) {
        return true;
    };

    this.getMemberType = function(name) {
        switch (name) {
            case 'int':
            case 'float':
            case 'bool':
            case '_null':
                return new CurriedForeignType(env, funcName, typeChain.concat([name]));
        }

        var returnType = null;
        if (typeChain[0] !== '_null') {
            returnType = types.resolve(typeChain[0]);
        }
        return new types.Func(returnType, typeChain.slice(1).map(types.resolve));
    };

    this.getReturnType = function() {
        if (typeChain[0] === '_null') return null;
        return types.resolve(typeChain[0]);
    };

    this.getArgs = function() {
        return typeChain.slice(1).map(types.resolve);
    };

    this.hasMethod = function() {return false;};
    this.isSubscriptable = function() {return false;};

}


exports.get = function(env) {
    var ctx = new context.Context(env, new nodes.Root({body: []}));

    ctx.exports.Math = ctx.addVar('Math', new StdlibType(env, 'Math', MathRaw));
    ctx.exports.external = ctx.addVar('external', new ForeignType(env));

    return ctx;
};
