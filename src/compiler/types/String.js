var types = require('../types');


function String_() {
    // no-op
}

String_.prototype._type = 'string';

String_.prototype.subscript = function subscript(index) {
    return 8 + index * 4; // 4 == sizeof(uint)
};
String_.prototype.getSize = function getSize() {
    return null; // Must be special-cased.
};

String_.prototype.flatTypeName = String_.prototype.toString = function toString() {
    return 'string';
};

String_.prototype.equals = function equals(x) {
    if (x instanceof types.Array && x.contentsType.equals(types.uint)) return true;
    return x instanceof String_;
};

String_.prototype.isSubscriptable = function isSubscriptable() {
    return true;
};

String_.prototype.getSubscriptType = function getSubscriptType(index) {
    return private_.uint;
};

String_.prototype.hasMember = function hasMember(name) {
    return name === 'length';
};

String_.prototype.getMemberType = function getMemberType(name) {
    return {length: types.publicTypes.int}[name];
};

module.exports = String_;
