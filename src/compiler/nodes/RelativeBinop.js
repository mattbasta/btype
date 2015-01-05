var binop = require('./_binop');
var indentEach = require('./_utils').indentEach;


exports.traverse = binop.traverse;
exports.substitute = binop.substitute;
exports.getType = binop.getType,

exports.validateTypes = function validateTypes(ctx) {
    this.left.validateTypes(ctx);
    this.right.validateTypes(ctx);
    if (!this.left.getType(ctx).equals(this.right.getType(ctx))) {
        throw new TypeError('Comparison operations may only be performed against same types');
    }
};

exports.toString = function toString() {
    return 'RelativeBinop(' + this.operator + '):\n' +
           '    Left:\n' +
           indentEach(this.left.toString(), 2) + '\n' +
           '    Right:\n' +
           indentEach(this.right.toString(), 2) + '\n';
};
