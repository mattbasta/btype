var indentEach = require('./_utils').indentEach;


exports.traverse = function traverse(cb) {
    if (this.value) cb(this.value);
};

exports.substitute = function substitute(cb) {
    if (!this.value) return;
    this.value = cb(this.value, 'value') || this.value;
};

exports.validateTypes = function validateTypes(ctx) {
    if (this.value) this.value.validateTypes(ctx);

    var valueType = this.value ? this.value.getType(ctx) : null;
    var func = ctx.scope;
    var funcReturnType = func.returnType && func.returnType.getType(ctx);
    if (!!valueType !== !!funcReturnType) {
        throw new TypeError('Mismatched void/typed return type');
    }

    if (!valueType) return;

    if (!funcReturnType.equals(valueType)) {
        throw new TypeError('Mismatched return type: ' + funcReturnType.toString() + ' != ' + valueType.toString());
    }
};

exports.toString = function toString() {
    return 'Return:\n' +
           (this.value ? indentEach(this.value.toString()) : '    void') + '\n';
};
