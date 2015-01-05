var indentEach = require('./_utils').indentEach;


exports.traverse = function traverse(cb) {
    if (this.declType) cb(this.declType, 'type');
    cb(this.value, 'value');
};

exports.substitute = function substitute(cb) {
    this.value = cb(this.value, 'value') || this.value;
};

exports.getType = function getType(ctx) {
    return (this.declType || this.value).getType(ctx);
};

exports.validateTypes = function validateTypes(ctx) {
    this.value.validateTypes(ctx);
    if (!this.declType) return;
    var declType = this.declType.getType(ctx);
    var valueType = this.value.getType(ctx);
    if (!valueType.equals(declType)) {
        throw new TypeError('Mismatched types in declaration: ' + declType.toString() + ' != ' + valueType.toString());
    }
};

exports.toString = function toString() {
    return 'Declaration(' + this.identifier + (this.__assignedName ? '::' + this.__assignedName : '') + ')\n' +
           (!this.declType ? '' :
               '    Type:\n' +
               indentEach(this.declType.toString(), 2) + '\n'
            ) +
           '    Value:\n' +
           indentEach(this.value.toString(), 2);
};
