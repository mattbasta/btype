var types = require('../types');

var ident = require('./_utils').ident;
var indentEach = require('./_utils').indentEach;


exports.traverse = function traverse(cb) {
    this.body.forEach(function(stmt) {
        cb(stmt, 'body');
    });
};

exports.traverseStatements = function traverseStatements(cb) {
    cb(this.body, 'body');
};

exports.substitute = function substitute(cb) {
    this.body = this.body.map(function(stmt) {
        return cb(stmt, 'body');
    }).filter(ident);
};

exports.validateTypes = function validateTypes(ctx) {
    this.body.forEach(function(s) {
        s.validateTypes(ctx);
    });
};

exports.toString = function toString() {
    return 'Block:\n' + indentEach(this.body.map(function(stmt) {return stmt.toString();}).join('\n'), 1);
};

exports.translate = function translate(ctx) {
    return this;
};
