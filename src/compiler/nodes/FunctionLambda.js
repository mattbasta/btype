var Function = require('./Function')
var ident = require('./_utils').ident;
var indentEach = require('./_utils').indentEach;
var types = require('../types');


exports.traverse = Function.traverse;
exports.traverseStatements = Function.traverseStatements;
exports.substitute = Function.substitute;
exports.validateTypes = Function.validateTypes;
exports.toString = Function.toString;


exports.getType = function getType(ctx) {
    if (this.__originalType) {
        return this.__originalType;
    }
    if (this.__type) return this.__type;

    var returnType = null;
    if (this.returnType) {
        returnType = this.returnType.getType(ctx);
        if (!returnType) {
            throw new TypeError('Non-void function with undefined return type: ' + this.returnType.toString());
        }
    }

    var paramTypes = [];
    this.params.forEach(function(p, i) {
        var type = p.getType(ctx);
        if (!type) {
            throw new TypeError('Function with parameter (' + i + ') with undefined type: ' + p.toString());
        }
        paramTypes.push(type);
    });

    return this.__type = new types.Func(returnType, paramTypes);
};
