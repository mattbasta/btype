exports.traverse = function traverse(cb) {
    cb(this.idType);
};

exports.substitute = function substitute() {};

exports.getType = function getType(ctx) {
    return this.idType.getType(ctx);
};

exports.validateTypes = function validateTypes() {};

exports.toString = function toString() {
    return 'TypedId(' + this.name + (this.__assignedName ? ':' + this.__assignedName : '') + ': ' + this.idType.toString() + ')';
};
