var indentEach = require('./_utils').indentEach;


exports.traverse = function traverse() {};

exports.substitute = function substitute() {};

exports.validateTypes = function validateTypes(ctx) {
    try {
        var elemName = this.__assignedName;
        var elemType = ctx.typeMap[elemName];

        if (elemType._type !== 'func') {
            throw new TypeError('Cannot export non-executable objects');
        }
    } catch(e) {
        if (!ctx.prototypes[this.value]) {
            throw new TypeError('Cannot export undefined variable or type: ' + this.value);
        }
    }
};

exports.toString = function toString() {
    return 'Export:\n' +
           indentEach(this.value.toString()) + '\n';
};
