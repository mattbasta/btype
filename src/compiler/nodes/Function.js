var types = require('../types');

var ident = require('./_utils').ident;
var indentEach = require('./_utils').indentEach;


exports.traverse = function traverse(cb) {
    if (this.returnType)
        cb(this.returnType, 'return');

    this.body.forEach(function(stmt) {
        cb(stmt, 'body');
    });
};

exports.traverseStatements = function traverseStatements(cb) {
    cb(this.body, 'body');
};

exports.substitute = function substitute(cb) {
    this.body = this.body.map(function(stmt) {
        return cb(stmt, 'stmt');
    }).filter(ident);
};

exports.getType = function getType(ctx) {
    if (this.__originalType) {
        return this.__originalType;
    }
    var returnType = this.returnType ? this.returnType.getType(ctx) : null;
    return new types.Func(
        returnType,
        this.params.map(function(p) {
            return p.getType(ctx);
        })
    );
};

exports.validateTypes = function validateTypes(ctx) {
    var context = this.__context;
    this.body.forEach(function(stmt) {
        stmt.validateTypes(context);
    });
};

exports.toString = function toString() {
    return 'Function ' + this.name + (this.__assignedName ? '::' + this.__assignedName : '') +
               '(' + this.params.map(function(param) {return param.toString();}).join(', ') + ') ' +
               (this.returnType ? this.returnType.toString() : 'void') + '\n' +
           indentEach(this.body.map(function(stmt) {return stmt.toString();}).join('\n'));
};
