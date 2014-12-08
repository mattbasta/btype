var context = require('../context');
var lexer = require('../../lexer');
var parser = require('../../parser');
var nodes = require('../nodes');

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

function StdlibType(env, raw) {
    this._type = '_stdlib';

    var raw = context(env, parser(lexer(raw)));

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
}

function ForeignType() {
    this._type = '_foreign';

    this.equals = function(x) {
        return false;
    };

    this.flatTypeName = this.toString = this.flatTypeName = function() {
        return 'module';
    };

    this.hasMember = function(name) {
        return true;
    };

    this.getMemberType = function(name) {
        return new StdlibType();
    };

}

exports.get = function(env) {
    var ctx = new context.Context(env, new nodes.Root({body: []}));

    ctx.exports.Math = ctx.addVar('Math', new StdlibType(env, MathRaw));

    return ctx;
};
