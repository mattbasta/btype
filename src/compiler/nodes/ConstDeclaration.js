var Declaration = require('./Declaration');


exports.traverse = Declaration.traverse;
exports.substitute = Declaration.substitute;
exports.translate = Declaration.translate;
exports.getType = Declaration.getType;

exports.validateTypes = function validateTypes(ctx) {
    var valueType = this.value.getType(ctx);
    if (valueType._type !== 'primitive') {
        throw new TypeError('Cannot assign non-primitive values to constants: ' + valueType.toString());
    }
    return Declaration.validateTypes.call(this, ctx);
};

exports.toString = function toString() {
    return 'Const' + Declaration.toString.call(this);
};
