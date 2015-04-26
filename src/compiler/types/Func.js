function Func(returnType, args) {
    this.returnType = returnType;
    this.args = args;
}

Func.prototype._type = 'func';

Func.prototype.equals = function equals(x) {
    if (!(x instanceof Func)) return false;
    if (!(this.returnType ? this.returnType.equals(x.returnType) : !x.returnType)) return false;
    if (this.args.length !== x.args.length) return false;
    return this.args.every(function(arg, i) {
        return arg.equals(x.args[i]);
    });
};

Func.prototype.toString = function toString() {
    return 'func<' +
        (this.returnType ? this.returnType.toString() : 'null') +
        (this.args.length ? ',' + this.args.map(function(arg) {
            return arg.toString();
        }).join(',') : '') +
        '>';
};

Func.prototype.flatTypeName = function flatTypeName() {
    return 'func$' +
        (this.returnType ? this.returnType.toString() : 'null') +
        (this.args.length ? '$' + this.args.map(function(arg) {
            return arg.toString();
        }).join('$') : '') +
        '$$';
};

Func.prototype.getReturnType = function getReturnType() {
    return this.returnType;
};

Func.prototype.getArgs = function getArgs() {
    return this.args;
};

Func.prototype.getSize = function getSize() {
    // This should return the size of a function reference.
    return 8; // 4 for functable index, 4 for pointer to context
};

Func.prototype.isSubscriptable = function isSubscriptable() {
    return false;
};


module.exports = Func;
