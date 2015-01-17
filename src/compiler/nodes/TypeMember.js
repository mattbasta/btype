var indentEach = require('./_utils').indentEach;


exports.traverse = function traverse(cb) {
    cb(this.base, 'base');
};

exports.substitute = function substitute(cb) {
    this.base = cb(this.base, 'base') || this.base;
};

exports.getType = function getType(ctx) {
    var baseType = this.base.getType(ctx);

    if (!baseType.hasType(this.child)) {
        throw new TypeError('Requesting incompatible type (' + this.child + ') from type "' + this.base.toString() + '"');
    }

    return baseType.getTypeOf(this.child);

};

exports.validateTypes = function validateTypes(ctx) {
    var baseType = this.base.getType(ctx);
    if (!baseType.hasType || !baseType.hasType(this.child)) {
        throw new TypeError('Requesting unknown type (' + this.child + ') from type "' + this.base.toString() + '"');
    }
    this.base.validateTypes(ctx);
};

exports.toString = function toString() {
    return 'TypeMember(' + this.child + '):\n' +
           indentEach(this.base.toString());
};
