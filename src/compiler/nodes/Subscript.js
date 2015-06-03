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
    var subscriptType = this.subscript.getType(ctx);

    // Support for subscript overloading
    var temp;
    if ((temp = ctx.env.registeredOperators[baseType.flatTypeName()]) &&
        (temp = temp[subscriptType.flatTypeName()]) &&
        (temp = temp['[]'])) {

        return ctx.env.registeredOperatorReturns[temp];
    }

    var index = null;
    if (this.subscript.type === 'Literal' &&
        this.subscript.litType === 'int') {
        index = this.subscript.value;
    }
    return baseType.getSubscriptType(index) || null;
};

exports.translate = function translate(ctx) {
    this.base = this.base.translate(ctx);
    this.subscript = this.subscript.translate(ctx);
    return this;
};

exports.validateTypes = function validateTypes(ctx, parentNode) {
    var baseType = this.base.getType(ctx);
    var subscriptType = this.subscript.getType(ctx);

    // Don't perform any further type validation if the subscript is overloaded
    var temp;
    if ((temp = ctx.env.registeredOperators[baseType.flatTypeName()]) &&
        (temp = temp[subscriptType.flatTypeName()]) &&
        '[]' in temp) {
        return;
    }

    if (!baseType.isSubscriptable()) {
        throw new TypeError('Cannot subscript ' + this.toString());
    }

    if (subscriptType._type !== 'primitive' ||
        subscriptType.typeName !== 'int') {
        throw new TypeError('Cannot subscript with a non-int value. (' + subscriptType.toString() + ' given)');
    }

    if (parentNode && parentNode.type === 'Declaration' && !parentNode.declType &&
        baseType._type === 'tuple') {
        if (this.subscript.type !== 'Literal' ||
            subscriptType._type !== 'primitive' ||
            subscriptType.typeName !== 'int') {
            throw new TypeError('Cannot subscript tuple with non-int literal vlaue');
        }
        if (this.subscript.value < 0 || this.subscript.value >= baseType.contentsTypeArr.length) {
            throw new TypeError('Invalid subscript for tuple: ' + this.subscript.value + ' of ' + baseType.toString());
        }
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
