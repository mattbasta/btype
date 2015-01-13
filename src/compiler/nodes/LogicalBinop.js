var binop = require('./_binop');
var indentEach = require('./_utils').indentEach;


exports.traverse = binop.traverse;
exports.substitute = binop.substitute;
exports.getType = binop.getType,

exports.validateTypes = function validateTypes(ctx) {
    this.left.validateTypes(ctx);
    this.right.validateTypes(ctx);

    binop.checkBinopOperation.call(this, ctx, this.left.getType(ctx), this.right.getType(ctx));

};

exports.toString = function toString() {
    return 'LogicalBinop(' + this.operator + '):\n' +
           '    Left:\n' +
           indentEach(this.left.toString(), 2) + '\n' +
           '    Right:\n' +
           indentEach(this.right.toString(), 2) + '\n';
};

exports.isOverloaded = binop.isOverloaded;
