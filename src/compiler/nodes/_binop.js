var types = require('../types');


exports.traverse = function traverse(cb) {
    cb(this.left, 'left');
    cb(this.right, 'right');
};

exports.substitute = function substitute(cb) {
    this.left = cb(this.left, 'left') || this.left;
    this.right = cb(this.right, 'right') || this.right;
};

exports.getType = function getType(ctx) {
    var leftType = this.left.getType(ctx);
    var rightType = this.right.getType(ctx);

    var temp;
    if ((temp = ctx.env.registeredOperators[leftType.toString()]) &&
        (temp = temp[rightType.toString()]) &&
        (temp = temp[this.operator])) {

        return ctx.env.registeredOperatorReturns[temp];
    }

    return types.publicTypes.bool;
};
