var types = require('../types');
var utils = require('./_utils');


function Struct(name, contentsTypeMap) {
    this.typeName = name;
    this.contentsTypeMap = contentsTypeMap;

    this.objConstructor = null;
    this.methods = {} // Mapping of given names to assigned names

    this.privateMembers = {}; // Set of assigned names that are marked as private
    this.finalMembers = {}; // Set of assigned names that are marked as final

    // WARNING! This must not do any processing on contentsTypeMap as part of
    // this constructor. All processing must be done by methods. This is to
    // facilitate lazily constructed structs, which are necessary for self-
    // referencing and cyclic type dependencies.

    function getLayout() {
        var keys = Object.keys(contentsTypeMap);
        keys.sort(function(a, b) {
            return utils.memberSize(a) < utils.memberSize(b);
        });
        return keys;
    }

    var cachedLayout;
    this.getLayout = function() {
        if (cachedLayout) return cachedLayout;
        var layout = getLayout();
        var offsets = {};
        var i = 0;
        layout.forEach(function(key) {
            var size = utils.memberSize(this.contentsTypeMap[key]);
            offsets[key] = i;
            i += size;
        }, this);
        return cachedLayout = offsets;
    };

    var cachedOrderedLayout;
    this.getOrderedLayout = function() {
        if (cachedOrderedLayout) return cachedOrderedLayout;
        var order = getLayout().map(function(member) {
            return contentsTypeMap[member];
        });
        return cachedOrderedLayout = order;
    };

    var cachedLayoutIndices;
    this.getLayoutIndex = function(name) {
        if (cachedLayoutIndices) return cachedLayoutIndices[name];
        var layout = getLayout();
        var indices = {};
        layout.forEach(function(key, i) {
            indices[key] = i;
        });
        return (cachedLayoutIndices = indices)[name];
    };

}

Struct.prototype._type = 'struct';

Struct.prototype.getSize = function getSize() {
    var sum = 0;
    for (var key in this.contentsTypeMap) {
        sum += utils.memberSize(this.contentsTypeMap[key]);
    }
    return sum;
};

Struct.prototype.equals = function equals(x) {
    // Ignore null types.
    if (!x) return false;
    // If we have an assigned name, compare that.
    if (this.__assignedName === x.__assignedName) return true;
    // If the other one isn't a struct or has a different name, fail.
    if (!(x instanceof Struct && this.typeName === x.typeName)) return false;
    // If the number of members is not the same, fail.
    if (Object.keys(this.contentsTypeMap).length !== Object.keys(x.contentsTypeMap).length) return false;
    // Test each member for equality.
    for (var key in this.contentsTypeMap) {
        // If the member is not in the other struct, fail.
        if (!(key in x.contentsTypeMap)) return false;
        // If the member is the same type, fail.
        if (!this.contentsTypeMap[key].equals(x.contentsTypeMap[key])) return false;
    }
    return true;
};

Struct.prototype.toString = function toString() {
    return this.typeName;
};

Struct.prototype.flatTypeName = function flatTypeName() {
    return 'struct$' + (this.__assignedName || this.typeName);
};

Struct.prototype.hasMethod = function hasMethod(name) {
    return name in this.methods;
};

Struct.prototype.getMethod = function getMethod(name) {
    return this.methods[name];
};

Struct.prototype.getMethodType = function getMethodType(name, ctx) {
    var temp = ctx.lookupFunctionByName(this.getMethod(name)).getType(ctx);
    temp.__isMethod = true;
    return temp;
};

Struct.prototype.hasMember = function hasMember(name) {
    return name in this.contentsTypeMap;
};

Struct.prototype.getMemberType = function getMemberType(name) {
    return this.contentsTypeMap[name];
};

Struct.prototype.isSubscriptable = function isSubscriptable() {
    return false;
};

module.exports = Struct;
