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
    var type = this.getType(ctx);
    if (type._type === 'primitive') {
        throw new Error('Cannot create instance of primitive: ' + type.toString());
    }
    // TODO: Check that the params match the params of the constructor
};

exports.toString = function toString() {
    return 'New: ' + this.newType.toString() + (this.params.length ? '\n' : '') +
           indentEach(this.params.map(function(stmt) {return stmt.toString();}).join('\n'), 1);
};
