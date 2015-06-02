var indentEach = require('./_utils').indentEach;


exports.traverse = function traverse() {};
exports.substitute = function substitute() {};
exports.translate = function translate() {return this;};
exports.validateTypes = function validateTypes(ctx) {};

exports.toString = function toString() {
    return 'Import:\n' +
           '    Base:\n' +
           indentEach(this.base.toString(), 2) + '\n' +
           (this.member ?
            '    Member:\n' +
            indentEach(this.member.toString(), 2) + '\n' : '') +
           (this.alias ?
            '    Alias:\n' +
            indentEach(this.alias.toString(), 2) + '\n' : '');
};
