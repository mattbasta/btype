exports.traverse = function traverse() {};

exports.substitute = function substitute() {};

exports.getType = function getType(ctx) {
    if (this.__refType) return this.__refType;
    var objContext = ctx.lookupVar(this.name);
    return objContext.typeMap[this.__refName];
};

exports.validateTypes = function validateTypes() {};

exports.toString = function toString() {
    return 'Symbol(' + this.name + (this.__refName ? '::' + this.__refName : '') + ')';
};
