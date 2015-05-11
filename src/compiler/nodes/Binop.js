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

    var leftType = this.left.getType(ctx);
    var rightType = this.right.getType(ctx);

    // Don't perform any further type validation if the operator is overloaded
    var temp;
    if ((temp = ctx.env.registeredOperators[leftType.flatTypeName()]) &&
        (temp = temp[rightType.flatTypeName()]) &&
        this.operator in temp) {
        return;
    }

    if (!leftType.equals(rightType)) {
        throw new TypeError('Mismatched types in binop (' + this.operator + ' near char ' + this.start + '): ' + (leftType || 'null').toString() + ' != ' + (rightType || 'null').toString());
    }

    binop.checkBinopOperation.call(this, ctx, leftType, rightType);
};

exports.toString = function toString() {
    return 'Binop(' + this.operator + '):\n' +
           '    Left:\n' +
           indentEach(this.left.toString(), 2) + '\n' +
           '    Right:\n' +
           indentEach(this.right.toString(), 2);
};

exports.isOverloaded = binop.isOverloaded;
