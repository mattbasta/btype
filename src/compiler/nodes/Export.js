var indentEach = require('./_utils').indentEach;


exports.traverse = function traverse(cb) {
    cb(this.value);
};

exports.substitute = function substitute() {};

exports.validateTypes = function validateTypes(ctx) {
    this.value.validateTypes(ctx);
    var valueType = this.value.getType(ctx);
    if (valueType._type !== 'func') {
        throw new TypeError('Cannot export non-executable objects');
    }
};

exports.toString = function toString() {
    return 'Export:\n' +
           indentEach(this.value.toString()) + '\n';
};
