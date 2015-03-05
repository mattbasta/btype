var binop = require('./_binop');
var indentEach = require('./_utils').indentEach;


exports.traverse = binop.traverse;
exports.substitute = binop.substitute;
exports.getType = binop.getType,

exports.validateTypes = function validateTypes(ctx) {
    this.left.validateTypes(ctx);
    this.right.validateTypes(ctx);

    var leftType = this.left.getType(ctx);
    var rightType = this.right.getType(ctx);
    if (leftType && leftType._type === 'primitive' && !rightType) {
        throw new TypeError('Cannot test primitive for equality with `null`: ' + leftType.toString());

    } else if (rightType && rightType._type === 'primitive' && !leftType) {
        throw new TypeError('Cannot test primitive for equality with `null`: ' + rightType.toString());

    } else if (leftType && rightType && !leftType.equals(rightType)) {
        leftType = leftType || 'null';
        rightType = rightType || 'null';
        throw new TypeError('Equality operations may only be performed against same types: ' + leftType.toString() + ' != ' + rightType.toString());

    }

    binop.checkBinopOperation.call(this, ctx, this.left.getType(ctx), this.right.getType(ctx));

};

exports.toString = function toString() {
    return 'EqualityBinop(' + this.operator + '):\n' +
           '    Left:\n' +
           indentEach(this.left.toString(), 2) + '\n' +
           '    Right:\n' +
           indentEach(this.right.toString(), 2) + '\n';
};

exports.isOverloaded = binop.isOverloaded;
