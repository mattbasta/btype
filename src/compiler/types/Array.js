var utils = require('./_utils');

var types = require('../types');


function Array_(contentsType) {
    this.contentsType = contentsType;
}

Array_.prototype._type = 'array';

Array_.prototype.subscript = function(index) {
    // We have an offset of 8 because primitives that take up eight bytes
    // need to be aligned to a multiple of 8 on the heap.
    return 8 + index * utils.memberSize(this.contentType);
};

Array_.prototype.getSize = function() {
    return null; // Must be special-cased.
};

Array_.prototype.toString = function() {
    return 'array<' + this.contentsType.toString() + '>';
};

Array_.prototype.flatTypeName = function() {
    return 'array$' + this.contentsType.flatTypeName();
};

Array_.prototype.equals = function(x) {
    if (x instanceof types.String && this.contentsType.equals(types.uint)) return true;
    return x instanceof types.Array && this.contentsType.equals(x.contentsType);
};

Array_.prototype.isSubscriptable = function() {
    return true;
};

Array_.prototype.getSubscriptType = function(index) {
    return this.contentsType;
};

Array_.prototype.hasMember = function(name) {
    return name === 'length';
};

Array_.prototype.getMemberType = function(name) {
    return {length: types.publicTypes.int}[name];
};

module.exports = Array_;
