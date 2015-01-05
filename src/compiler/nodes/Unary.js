var types = require('../types');


exports.traverse = function traverse(cb) {
    cb(this.base);
};

exports.substitute = function substitute(cb) {
    this.base = cb(this.base, 'base') || this.base;
};

exports.getType = function getType(ctx) {
    return this.operator === '-' ? this.base.getType(ctx) : types.publicTypes.bool;
};

exports.validateTypes = function validateTypes(ctx) {
    this.base.validateTypes(ctx);
    if (this.operator === '-') {
        var baseType = this.base.getType(ctx);
        if (baseType.typeName !== 'int' && baseType.typeName !== 'float') {
            throw new TypeError('Invalid type for unary minus: ' + baseType.toString());
        }
    }
};

exports.toString = function toString() {
    return 'Unary(' + this.operator + '): ' + this.base.toString() + '\n';
};
