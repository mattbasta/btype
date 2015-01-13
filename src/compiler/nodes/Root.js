var indentEach = require('./_utils').indentEach;


exports.traverse = function traverse(cb) {
    this.body.forEach(function traverseBody(stmt) {
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
    this.body.forEach(function(stmt) {
        stmt.validateTypes(ctx);
    });
};

exports.toString = function toString() {
    return 'Root:\n' + indentEach(this.body.map(function toStringBody(stmt) {
        return stmt.toString();
    }).join('\n')) + '\n';
};
