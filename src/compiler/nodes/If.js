var types = require('../types');

var ident = require('./_utils').ident;
var indentEach = require('./_utils').indentEach;


exports.traverse = function traverse(cb) {
    cb(this.condition, 'condition');
    this.consequent.forEach(function(stmt) {
        cb(stmt, 'consequent');
    });
    if (this.alternate) {
        this.alternate.forEach(function(stmt) {
            cb(stmt, 'alternate');
        });
    }
};

exports.traverseStatements = function traverseStatements(cb) {
    cb(this.consequent, 'consequent');
    cb(this.alternate, 'alternate');
};

exports.substitute = function substitute(cb) {
    this.condition = cb(this.condition, 'condition') || this.condition;
    this.consequent = this.consequent.map(function(stmt) {
        return cb(stmt, 'consequent');
    }).filter(ident);
    if (!this.alternate) return;
    this.alternate = this.alternate.map(function(stmt) {
        return cb(stmt, 'alternate');
    }).filter(ident);
};

exports.validateTypes = function validateTypes(ctx) {
    this.condition.validateTypes(ctx);
    if(!this.condition.getType(ctx).equals(types.publicTypes.bool))
        throw new TypeError('Unexpected type passed as condition');
    this.consequent.forEach(function(stmt) {
        stmt.validateTypes(ctx);
    });
    if (this.alternate) {
        this.alternate.forEach(function(stmt) {
            stmt.validateTypes(ctx);
        });
    }
};

exports.toString = function toString() {
    return 'If:\n' +
           '    Condition:\n' +
           indentEach(this.condition.toString(), 2) + '\n' +
           '    Consequent:\n' +
           indentEach(this.consequent.map(function(stmt) {return stmt.toString();}).join('\n'), 2) +
           (!this.alternate ? '' :
               '\n    Alternate:\n' +
               indentEach(this.alternate.map(function(stmt) {return stmt.toString();}).join('\n'), 2)
            );
};
