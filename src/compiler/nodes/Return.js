var indentEach = require('./_utils').indentEach;


exports.traverse = function traverse(cb) {
    if (this.value) cb(this.value);
};

exports.substitute = function substitute(cb) {
    if (!this.value) return;
    this.value = cb(this.value, 'value') || this.value;
};

exports.translate = function translate(ctx) {
    if (this.value) this.value = this.value.translate(ctx);
    return this;
};

exports.validateTypes = function validateTypes(ctx) {
    if (!ctx.parent) {
        throw new TypeError('Return statements must be within functions');
    }

    if (this.value) this.value.validateTypes(ctx);

    var func = ctx.scope;
    var funcReturnType = func.returnType && func.returnType.getType(ctx);
    if (!!this.value !== !!funcReturnType) {
        throw new TypeError('Mismatched void/typed return type');
    }

    if (!this.value) return;

    var valueType = this.value.getType(ctx, funcReturnType);
    if (!funcReturnType.equals(valueType)) {
        throw new TypeError('Mismatched return type: ' + funcReturnType.toString() + ' != ' + valueType.toString());
    }
};

exports.toString = function toString() {
    return 'Return:\n' +
           (this.value ? indentEach(this.value.toString()) : '    void');
};
