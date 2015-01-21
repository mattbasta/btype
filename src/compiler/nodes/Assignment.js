var indentEach = require('./_utils').indentEach;


exports.traverse = function traverse(cb) {
    cb(this.base, 'base');
    cb(this.value, 'value');
};

exports.substitute = function substitute(cb) {
    this.base = cb(this.base, 'base') || this.base;
    this.value = cb(this.value, 'value') || this.value;
};

exports.getType = function getType(ctx) {
    return this.value.getType(ctx);
};

exports.validateTypes = function validateTypes(ctx) {
    var baseType = this.base.getType(ctx);
    var valueType = this.value.getType(ctx);
    if (!baseType.equals(valueType)) {
        throw new TypeError('Mismatched types in assignment: ' + baseType.toString() + ' != ' + valueType.toString() + ' near char ' + this.start);
    }
    this.value.validateTypes(ctx);
};

exports.toString = function toString() {
    return 'Assignment:\n' +
           '    Lval:\n' +
           indentEach(this.base.toString(), 2) + '\n' +
           '    Rval:\n' +
           indentEach(this.value.toString(), 2);
};
