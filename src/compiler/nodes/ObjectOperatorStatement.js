exports.traverse = function traverse(cb) {
    cb(this.base, 'base');
};

exports.substitute = function substitute(cb) {
    this.base = cb(this.base, 'base') || this.base;
};

exports.getType = function getType(ctx) {
    return this.base.getType(ctx);
};

exports.validateTypes = function validateTypes(ctx) {
    return this.base.validateTypes(ctx);
};

exports.toString = function toString() {
    return this.base.toString();
};
