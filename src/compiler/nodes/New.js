var ident = require('./_utils').ident;
var indentEach = require('./_utils').indentEach;


exports.traverse = function traverse(cb) {
    if (this.newType && this.newType.type)
        cb(this.newType);
    this.params.forEach(function(param) {
        cb(param, 'params');
    });
};

exports.substitute = function substitute(cb) {
    this.callee = cb(this.callee, 'callee') || this.callee;
    this.params = this.params.map(function(stmt) {
        return cb(stmt, 'params');
    }).filter(ident);
};

exports.getType = function getType(ctx) {
    return this.newType.getType(ctx);
};

exports.validateTypes = function validateTypes(ctx) {

    if (this.params.length) {
        this.params.forEach(function(param) {
            param.validateTypes(ctx);
        });
    }

    var type = this.getType(ctx);

    if (!type) {
        throw new TypeError('Could not resolve type: ' + this.newType.toString());
    }

    if (type._type === 'primitive') {
        throw new Error('Cannot create instance of primitive: ' + type.toString());
    } else if (type._type === 'struct') {
        if (this.params.length && !type.objConstructor) {
            throw new Error('Parameters passed to object without constructor');
        }

        if (!type.objConstructor) return;

        var constructorFunc = ctx.lookupFunctionByName(type.objConstructor);
        if (this.params.length !== constructorFunc.params.length - 1) {
            throw new Error('Number of parameters passed to constructor does not match object constructor signature');
        }

        this.params.forEach(function(param, i) {
            var paramType = param.getType(ctx);
            var argType = constructorFunc.params[i + 1].getType(constructorFunc.__context);
            if (!paramType.equals(argType)) {
                throw new TypeError('Constructor parameter (' + i + ') type mismatch: ' + paramType.toString() + ' != ' + argType.toString());
            }
        });
    }
};

exports.toString = function toString() {
    return 'New: ' + this.newType.toString() + (this.params.length ? '\n' : '') +
           indentEach(this.params.map(function(stmt) {return stmt.toString();}).join('\n'), 1);
};
