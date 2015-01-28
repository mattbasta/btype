var types = require('../types');


exports.traverse = function traverse(cb) {
    cb(this.left, 'left');
    cb(this.rightType, 'rightType');
};

exports.substitute = function substitute(cb) {
    this.left = cb(this.left, 'left') || this.left;
    this.rightType = cb(this.rightType, 'rightType') || this.rightType;
};

exports.getType = function getType(ctx) {
    return this.rightType.getType(ctx);
};


var safeCastMap = {
    bool: ['byte', 'int', 'uint'],
    byte: ['int', 'bool', 'float', 'sfloat', 'uint'],
    float: ['int', 'byte', 'bool', 'sfloat'],
    sfloat: ['float'],
    int: ['float', 'sfloat', 'bool', 'byte', 'uint'],
    uint: ['float', 'sfloat', 'int', 'byte'],
};
exports.validateTypes = function validateTypes(ctx) {
    this.left.validateTypes(ctx);
    this.rightType.validateTypes(ctx);

    var leftType = this.left.getType(ctx);
    var rightType = this.rightType.getType(ctx);

    if (leftType.equals(rightType)) {
        return;
    }

    if (leftType._type !== 'primitive') {
        throw new TypeError('Cannot typecast non-primitive: ' + leftType.toString() + ' as ' + rightType.toString());
    }

    if (rightType._type !== 'primitive') {
        throw new TypeError('Cannot typecast to non-primitive: ' + leftType.toString() + ' as ' + rightType.toString());
    }

    if (!(leftType.typeName in safeCastMap)) {
        throw new TypeError('Type "' + leftType.toString() + '" cannot be cast safely');
    }

    if (safeCastMap[leftType.typeName].indexOf(rightType.typeName) === -1) {
        throw new TypeError('Cannot cast type "' + leftType.toString() + '" to type "' + rightType.toString() + '"');
    }

};

exports.toString = function toString() {
    return 'TypeCast(' + this.rightType.toString() + '): ' + this.left.toString();
};
