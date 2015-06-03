exports.traverse = function traverse(cb) {
    cb(this.base, 'base');
};

exports.substitute = function substitute(cb) {
    this.base = cb(this.base, 'base') || this.base;
};

exports.translate = function translate(ctx) {
    this.base = this.base.translate(ctx);
    return this;
};

exports.getType = function getType(ctx) {
    return this.base.getType(ctx);
};

exports.validateTypes = function validateTypes(ctx) {
    this.base.validateTypes(ctx);
};

exports.toString = function toString() {
    return 'CallStatement: ' + this.base.toString();
};
