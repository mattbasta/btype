function Module(mod) {
    this.mod = mod;
    this.memberMapping = mod.exports;
}

Module.prototype._type = 'module';

Module.prototype.equals = function equals(x) {
    return false; // Modules do not have type equality.
};

Module.prototype.flatTypeName = Module.prototype.toString = function toString() {
    return 'module';
};

Module.prototype.hasMember = function hasMember(name) {
    return name in this.memberMapping;
};

Module.prototype.getMemberType = function getMemberType(name) {
    return this.mod.typeMap[this.memberMapping[name]];
};

Module.prototype.hasMethod = function hasMethod() {return false;};

Module.prototype.hasType = function hasType(name) {
    return name in this.mod.exportPrototypes;
};

Module.prototype.getTypeOf = function getTypeOf(name, attributes) {
    return this.mod.resolveType(name, attributes || []);
};

Module.prototype.isSubscriptable = function isSubscriptable() {
    return false;
};

module.exports = Module;
