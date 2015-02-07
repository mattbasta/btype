var indentEach = require('./_utils').indentEach;


exports.traverse = function traverse(cb) {
    cb(this.base, 'base');
    cb(this.ctx, 'ctx');
};

exports.substitute = function substitute(cb) {
    this.base = cb(this.base, 'base') || this.base;
    this.ctx = cb(this.ctx, 'ctx') || this.ctx;
};

exports.getType = function getType(ctx) {
    return this.base.getType(ctx);
};

exports.validateTypes = function validateTypes(ctx) {
    return this.base.validateTypes(ctx);
};

exports.toString = function toString() {
    return 'FunctionReference(' + (this.ctx ? this.ctx.toString() : 'null') + '):\n' +
        indentEach(this.base.toString()) + '\n';
};
