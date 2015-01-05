exports.traverse = function traverse(cb) {
    if (this.value) cb(this.value, 'value');
    cb(this.memberType, 'memberType');
};

exports.substitute = function substitute(cb) {
    this.value = cb(this.value, 'value') || this.value;
    this.memberType = cb(this.memberType, 'memberType') || this.memberType;
};

exports.getType = function getType(ctx) {
    return this.memberType.getType(ctx);
};

exports.validateTypes = function validateTypes(ctx) {
    if (this.value) this.value.validateTypes(ctx);
    this.memberType.validateTypes(ctx);
};

exports.toString = function toString() {
    return this.memberType.toString();
};
