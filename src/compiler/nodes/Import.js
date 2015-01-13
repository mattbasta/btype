var indentEach = require('./_utils').indentEach;


exports.traverse = function traverse(cb) {
    if (this.member) cb(this.member, 'member');
    if (this.alias) cb(this.alias, 'alias');
};

exports.substitute = function substitute() {};

exports.validateTypes = function validateTypes(ctx) {
    // this.base.validateTypes(ctx);
    // if (this.member) this.member.validateTypes(ctx);
    // if (this.alias) this.alias.validateTypes(ctx);
};

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
