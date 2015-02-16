var _loop = require('./_loop');

var indentEach = require('./_utils').indentEach;


exports.traverseStatements = function traverseStatements(cb) {
    cb(this.body, 'body');
};

exports.traverse = _loop.traverse;
exports.substitute = _loop.substitute;
exports.validateTypes = _loop.validateTypes;

exports.toString = function toString() {
    return 'DoWhile:\n' +
           '    Condition:\n' +
           indentEach(this.condition.toString(), 2) + '\n' +
           '    Body:\n' +
           indentEach(this.body.map(function(stmt) {return stmt.toString();}).join('\n'), 2) + '\n';
};
