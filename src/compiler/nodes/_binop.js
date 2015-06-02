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

var isOverloaded = exports.isOverloaded = function isOverloaded(ctx) {
    var temp;
    return (temp = ctx.env.registeredOperators[this.left.getType(ctx).toString()]) &&
           (temp = temp[this.right.getType(ctx).toString()]) &&
           (temp = temp[this.operator]) &&
           true;
};

exports.checkBinopOperation = function checkBinopOperation(ctx, left, right) {
    if (!isOverloaded.call(this, ctx) && left._type === 'primitive') {
        var safeLeftTypes;
        switch (this.operator) {
            case '+': safeLeftTypes = ['int', 'sfloat', 'float', 'byte', 'uint', 'str']; break;
            case '-': safeLeftTypes = ['int', 'sfloat', 'float', 'byte', 'uint']; break;
            case '*': safeLeftTypes = ['int', 'sfloat', 'float', 'byte', 'uint']; break;
            case '/': safeLeftTypes = ['int', 'sfloat', 'float', 'byte', 'uint']; break;
            case '%': safeLeftTypes = ['int', 'sfloat', 'float', 'byte', 'uint']; break;
            case '&': safeLeftTypes = ['int', 'byte', 'uint']; break;
            case '|': safeLeftTypes = ['int', 'byte', 'uint']; break;
            case '^': safeLeftTypes = ['int', 'byte', 'uint']; break;
            case '<<': safeLeftTypes = ['int', 'byte', 'uint']; break;
            case '>>': safeLeftTypes = ['int', 'byte', 'uint']; break;
            case 'and': safeLeftTypes = ['bool']; break;
            case 'or': safeLeftTypes = ['bool']; break;
            case '<': safeLeftTypes = ['int', 'sfloat', 'float', 'byte', 'uint']; break;
            case '<=': safeLeftTypes = ['int', 'sfloat', 'float', 'byte', 'uint']; break;
            case '>': safeLeftTypes = ['int', 'sfloat', 'float', 'byte', 'uint']; break;
            case '>=': safeLeftTypes = ['int', 'sfloat', 'float', 'byte', 'uint']; break;
            case '==': safeLeftTypes = ['int', 'sfloat', 'float', 'byte', 'uint', 'bool', 'str']; break;
            case '!=': safeLeftTypes = ['int', 'sfloat', 'float', 'byte', 'uint', 'bool', 'str']; break;
        }

        if (safeLeftTypes.indexOf(left.typeName) === -1) {
            throw new TypeError('Cannot use operator (' + this.operator + ') on type "' + left.toString() + '"');
        }
    }
};

exports.translate = function translate() {
    this.left = this.left.translate();
    this.right = this.right.translate();
    return this;
};
