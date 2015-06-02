var indentEach = require('./_utils').indentEach;


exports.traverse = function traverse(cb) {
    cb(this.caseType, 'caseType');
    this.body.forEach(function traverseSwitchTypeCaseBody(c) {
        cb(c, 'body');
    });
};

exports.substitute = function substitute() {
    this.caseType = cb(this.caseType, 'caseType') || this.caseType;
    this.body = this.body.map(function(stmt) {
        return cb(stmt, 'body');
    }).filter(ident);
};

exports.validateTypes = function validateTypes(ctx) {
    this.body.forEach(function switchTypeCaseValidator(stmt) {
        stmt.validateTypes(ctx);
    });
};

exports.getType = function getType(ctx) {
    return this.caseType.getType(ctx);
};

exports.toString = function toString() {
    return 'SwitchTypeCase:\n' +
           '    Type:\n' +
           indentEach(this.caseType.toString(), 2) + '\n' +
           '    Body:\n' +
           indentEach(this.body.map(function(stmt) {return stmt.toString();}).join('\n'), 2) + '\n';
};

exports.translate = function translate() {
    this.caseType = this.caseType.translate();
    this.body = this.body.map(function(s) {
        return s.translate();
    });
    return this;
};
