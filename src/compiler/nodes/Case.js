var indentEach = require('./_utils').indentEach;


exports.traverse = function traverse(cb) {
    cb(this.value, 'value');
    this.body.forEach(function(stmt) {
        cb(stmt, 'body');
    });
};

exports.traverseStatements = function traverseStatements(cb) {
    cb(this.body, 'body');
};

exports.substitute = function substitute(cb) {
    this.value = cb(this.value, 'value') || this.value;
    this.body = this.body.map(function(stmt) {
        return cb(stmt, 'stmt');
    }).filter(ident);
};

exports.validateTypes = function validateTypes(ctx) {
    this.body.forEach(function(stmt) {
        stmt.validateTypes(ctx);
    });
};

exports.toString = function toString() {
    return 'Case(' + this.value.toString() + '):\n' +
           indentEach(this.body.map(function(stmt) {return stmt.toString()}).join('\n'));
};
