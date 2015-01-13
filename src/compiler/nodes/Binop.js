var binop = require('./_binop');
var indentEach = require('./_utils').indentEach;


exports.traverse = binop.traverse;
exports.substitute = binop.substitute;

exports.getType = function getType(ctx) {
    var leftType = this.left.getType(ctx);
    var rightType = this.right.getType(ctx);

    var temp;
    if ((temp = ctx.env.registeredOperators[leftType.toString()]) &&
        (temp = temp[rightType.toString()]) &&
        (temp = temp[this.operator])) {

        return ctx.env.registeredOperatorReturns[temp];
    }
    return leftType;
};

exports.validateTypes = function validateTypes(ctx) {
    this.left.validateTypes(ctx);
    this.right.validateTypes(ctx);
    var left = this.left.getType(ctx);
    var right = this.right.getType(ctx);
    if (!left.equals(right)) {
        throw new TypeError('Mismatched types in binop (' + this.operator + '): ' + (left || 'null').toString() + ' != ' + (right || 'null').toString());
    }

    binop.checkBinopOperation.call(this, ctx, left, right);
};

exports.toString = function toString() {
    return 'Binop(' + this.operator + '):\n' +
           '    Left:\n' +
           indentEach(this.left.toString(), 2) + '\n' +
           '    Right:\n' +
           indentEach(this.right.toString(), 2) + '\n';
};

exports.isOverloaded = binop.isOverloaded;
