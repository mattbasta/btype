var types = require('../types');

var indentEach = require('./_utils').indentEach;


exports.traverse = function traverse(cb) {
    this.members.forEach(function(stmt) {
        cb(stmt, 'members');
    });
    this.methods.forEach(function(stmt) {
        cb(stmt, 'methods');
    });
    if (this.objConstructor) cb(this.objConstructor, 'objConstructor');
};

exports.substitute = function substitute(cb) {
    this.members = this.members.map(function(stmt) {
        return cb(stmt, 'members');
    }).filter(ident);
    this.methods = this.methods.map(function(stmt) {
        return cb(stmt, 'methods');
    }).filter(ident);
    this.objConstructor = cb(this.objConstructor, 'objConstructor') || this.objConstructor;
};

exports.getType = function getType(ctx) {
    var mapping = {};
    this.members.forEach(function(member) {
        mapping[member.name] = member.getType(ctx);
    });
    return new types.Struct(this.name, mapping);
};

exports.validateTypes = function validateTypes(ctx) {
    this.members.forEach(function(stmt) {
        stmt.validateTypes(ctx);
    });
    this.methods.forEach(function(stmt) {
        stmt.validateTypes(ctx);
    });
};

exports.toString = function toString() {
    return 'Object(' + this.name + (this.__assignedName ? '::' + this.__assignedName : '') + '):\n' +
        '    Members:\n' +
        indentEach(this.members.map(function(member) {return member.toString();}).join('\n'), 2) + '\n' +
        '    Constructor:\n' +
        (this.objConstructor ? indentEach(this.objConstructor.toString, 2) : '        void') + '\n' +
        '    Methods:\n' +
        indentEach(this.methods.map(function(method) {
            return method.name + ': ' + method.toString();
        }).join('\n'), 2);
};
