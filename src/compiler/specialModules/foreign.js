import RootNode from '../../astNodes/RootNode';
import lexer from '../../lexer';
var parser = require('../../parser');
var types = require('../types');
import Func from '../types/Func';
import * as symbols from '../../symbols';


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
    'func float:atan2(float:y, float:x) {}',
    'func float:pow(float:y, float:x) {}',
    'func float:getNaN() {}',
].join('\n');


const RAW = Symbol('raw');

class BaseForeignType {
    equals(x) {
        return false;
    }

    flatTypeName() {
        return 'foreign';
    }

    toString() {
        return 'foreign';
    }

    hasMember() {
        return true;
    }

    hasMethod() {
        return false;
    }
    isSubscriptable() {
        return false;
    }
}


class StdlibType extends BaseForeignType {
    constructor(env, name, raw) {
        super();
        this.name = name;
        var parsed = parser(lexer(raw));
        this[RAW] = parsed[symbols.FMAKEHLIR](env, true)[symbols.CONTEXT];

        this._type = '_stdlib';
    }

    hasMember(name) {
        return this[RAW].nameMap.has(name);
    }

    getMemberType(name) {
        return this[RAW].typeMap.has(this[RAW].nameMap.get(name));
    }
}

class ForeignType extends BaseForeignType {
    constructor(env) {
        super();
        this.env = env;

        this._type = '_foreign';
    }

    getMemberType(name) {
        return new CurriedForeignType(this.env, name, []);
    }

}

class CurriedForeignType extends BaseForeignType {
    constructor(env, funcName, typeChain) {
        super();
        this.funcName = funcName;
        this.typeChain = typeChain;

        this._type = '_foreign_curry';
    }

    getMemberType(name) {
        switch (name) {
            case 'int':
            case 'float':
            case 'bool':
            case 'str':
            case '_null':
                return new CurriedForeignType(env, this.funcName, this.typeChain.concat([name]));
        }

        var returnType = null;
        if (this.typeChain[0] !== '_null') {
            returnType = types.resolve(this.typeChain[0]);
        }
        return new Func(returnType, this.typeChain.slice(1).map(types.resolve));
    }

    getReturnType() {
        if (this.typeChain[0] === '_null') return null;
        return types.resolve(this.typeChain[0]);
    }

    getArgs() {
        return this.typeChain.slice(1).map(types.resolve);
    }

}


exports.get = function(env) {
    var fakeRoot = new RootNode([], 0, 0);
    var ctx = fakeRoot[symbols.FMAKEHLIR](env, true)[symbols.CONTEXT];

    ctx.exports.set('Math', ctx.addVar('Math', new StdlibType(env, 'Math', MathRaw)));
    ctx.exports.set('external', ctx.addVar('external', new ForeignType(env)));

    return ctx;
};
