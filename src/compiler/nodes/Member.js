var indentEach = require('./_utils').indentEach;

var types = require('../types');


exports.traverse = function traverse(cb) {
    cb(this.base, 'base');
};

exports.substitute = function substitute(cb) {
    this.base = cb(this.base, 'base') || this.base;
};

exports.getType = function getType(ctx) {
    var baseType = this.base.getType(ctx);

    if (baseType.hasMethod && baseType.hasMethod(this.child)) {
        return baseType.getMethodType(this.child, ctx);
    }

    if (!baseType.hasMember(this.child)) {
        throw new Error('Member not found for type "' + baseType.toString() + '": ' + this.child);
    }
    return baseType.getMemberType(this.child);
};

exports.validateTypes = function validateTypes(ctx) {
    var baseType = this.base.getType(ctx);

    if (!baseType.hasMember) {
        throw new TypeError('Invalid type for member expression: ' + baseType.toString());
    }

    if (!baseType.hasMember(this.child) &&
        (!baseType.hasMethod || !baseType.hasMethod(this.child))) {
        throw new TypeError('Requesting incompatible member (' + this.child + ') from type');
    }

    if (baseType instanceof types.Struct && baseType.privateMembers[this.child]) {
        var insideObjectScope = false;
        var tmp = ctx;
        while (tmp) {
            if (tmp.__basePrototype) {
                if (tmp.__basePrototype.getType(ctx).equals(baseType)) {
                    insideObjectScope = true;
                }
                break;
            }
            tmp = tmp.parent;
        }

        if (!insideObjectScope) {
            throw new TypeError('Accessing private member "' + this.child + '" from outside object declaration');
        }
    }

    this.base.validateTypes(ctx);
};

exports.toString = function toString() {
    return 'Member(' + this.child + '):\n' +
           indentEach(this.base.toString());
};
