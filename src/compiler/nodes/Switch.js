var indentEach = require('./_utils').indentEach;


exports.traverse = function traverse(cb) {
    cb(this.condition, 'condition');
    this.cases.forEach(oneArg(cb));
};

exports.substitute = function substitute(cb) {
    this.condition = cb(this.condition, 'condition') || this.condition;
    this.cases = this.cases.map(function(case_) {
        return cb(case_, 'case');
    }).filter(ident);
};

exports.validateTypes = function validateTypes(ctx) {
    this.cases.forEach(function(c) {
        c.validateTypes(ctx);
    });
};

exports.toString = function toString() {
    return 'Switch(' + this.condition.toString() + '):\n' +
           indentEach(this.cases.map(function(stmt) {return stmt.toString();}).join('\n'));
};
