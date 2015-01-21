var indentEach = require('./_utils').indentEach;


exports.traverse = function traverse(cb) {
    cb(this.base, 'base');
    cb(this.subscript, 'subscript');
};

exports.substitute = function substitute(cb) {
    this.base = cb(this.base, 'base') || this.base;
    this.subscript = cb(this.subscript, 'subscript') || this.subscript;
};

exports.getType = function getType(ctx) {
    var baseType = this.base.getType(ctx);
    var index = null;
    if (this.subscript.type === 'Literal' &&
        this.subscript.litType === 'int') {
        index = this.subscript.value;
    }
    return baseType.getSubscriptType(index) || null;
};

exports.validateTypes = function validateTypes(ctx) {
    var baseType = this.base.getType(ctx);
    if (!baseType.isSubscriptable()) {
        throw new TypeError('Cannot subscript ' + this.toString());
    }

    var subscriptType = this.subscript.getType(ctx);

    if (subscriptType._type !== 'primitive' ||
        subscriptType.typeName !== 'int') {
        throw new TypeError('Cannot subscript with a non-int value. (' + subscriptType.toString() + ' given)');
    }

    this.base.validateTypes(ctx);
    this.subscript.validateTypes(ctx);
};

exports.toString = function toString() {
    return 'Subscript:\n' +
           '    Base:\n' +
           indentEach(this.base.toString(), 2) + '\n' +
           '    Subscript Value:\n' +
           indentEach(this.subscript.toString(), 2) + '\n';
};
