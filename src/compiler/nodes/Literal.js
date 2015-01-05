var types = require('../types');


exports.traverse = function traverse() {};

exports.substitute = function substitute() {};

exports.getType = function getType() {
    return types.resolve(this.litType);
};

exports.validateTypes = function validateTypes() {};

exports.toString = function toString() {
    return 'Literal(' + this.value + ')';
};
