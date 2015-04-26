function Primitive(typeName, backing) {
    this.typeName = typeName;
    this.backing = backing;
}

Primitive.prototype._type = 'primitive';

Primitive.prototype.getSize = function() {
    switch (this.typeName) {
        case 'int':
        case 'uint':
        case 'sfloat':
            return 4;
        case 'byte':
        case 'bool':
            return 1;
        case 'float':
            return 8;
    }
};

Primitive.prototype.toString = Primitive.prototype.flatTypeName = function toString() {
    return this.typeName;
};

Primitive.prototype.equals = function equals(x) {
    return x instanceof Primitive && this.typeName === x.typeName;
};

Primitive.prototype.isSubscriptable = function isSubscriptable() {
    return false;
};

module.exports = Primitive;
