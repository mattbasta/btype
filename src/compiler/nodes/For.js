var _loop = require('./_loop');

var indentEach = require('./_utils').indentEach;


exports.traverseStatements = function traverseStatements(cb) {
    cb(this.loop, 'loop');
};

exports.traverse = _loop.traverse;
exports.substitute = _loop.substitute;
exports.validateTypes = _loop.validateTypes;

exports.toString = function toString() {
    return 'For:\n' +
           '    Assignment:\n' +
           indentEach(this.assignment.toString(), 2) + '\n' +
           '    Condition:\n' +
           indentEach(this.condition.toString(), 2) + '\n' +
           (this.iteration ?
            '    Iteration:\n' +
            indentEach(this.iteration.toString(), 2) + '\n' : '') +
           '    Body:\n' +
           indentEach(this.loop.map(function(stmt) {return stmt.toString();}).join('\n'), 2) + '\n';
};