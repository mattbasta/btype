var Declaration = require('./Declaration');


exports.traverse = Declaration.traverse;
exports.substitute = Declaration.substitute;
exports.getType = Declaration.getType;

exports.validateTypes = function validateTypes(ctx) {
    var valueType = this.value.getType(ctx);
    if (valueType._type !== 'primitive') {
        throw new TypeError('Cannot assign non-primitive values to constants: ' + valueType.toString());
    }
    return Declaration.validateTypes.call(this, ctx);
};

exports.translate = function translate(ctx) {
    if (this.value) this.value = this.value.translate(ctx);
    if (this.declType) this.declType = this.declType.translate(ctx);
    return new (require('../nodes').Declaration)(
        this.start,
        this.end,
        {
            __assignedName: this.__assignedName,
            __context: this.__context,
            value: this.value,
            declType: this.declType,
        }
    );
};

exports.toString = function toString() {
    return 'Const' + Declaration.toString.call(this);
};
