var indentEach = require('./_utils').indentEach;
var types = require('../types');


exports.traverse = function traverse(cb) {
    cb(this.base, 'base');
    cb(this.value, 'value');
};

exports.substitute = function substitute(cb) {
    this.base = cb(this.base, 'base') || this.base;
    this.value = cb(this.value, 'value') || this.value;
};

exports.getType = function getType(ctx) {
    return this.value.getType(ctx);
};

exports.validateTypes = function validateTypes(ctx) {
    var baseType = this.base.getType(ctx);
    var valueType = this.value.getType(ctx, baseType);
    if (!baseType.equals(valueType)) {
        throw new TypeError('Mismatched types in assignment: ' + baseType.toString() + ' != ' + valueType.toString() + ' near char ' + this.start);
    }

    if (baseType.__isMethod) {
        throw new TypeError('Cannot assign value to object method near char ' + this.start);
    }

    this.validateFinalMemberAssignment(ctx);

    this.value.validateTypes(ctx);
};

exports.validateFinalMemberAssignment = function validateFinalMemberAssignment(ctx) {
    // This check only applies to member assignments.
    if (this.base.type !== 'Member') return;

    var baseType = this.base.base.getType(ctx);

    // Ignore member assignments to non-objects.
    if (!(baseType instanceof types.Struct)) return;

    // Ignore member assignments if the member is not final.
    if (!baseType.finalMembers[this.base.child]) return;

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
        throw new TypeError('Setting value of final member "' + this.base.child + '" from outside object constructor');
    }

    if (!tmp.__basePrototype.objConstructor) {
        throw new TypeError('Cannot set final member "' + this.base.child + '" on object with no constructor');
    }

    if (tmp.__basePrototype.objConstructor.base !== tmp.scope) {
        throw new TypeError('Cannot set final member "' + this.base.child + '" on from outside object constructor');
    }

};

exports.toString = function toString() {
    return 'Assignment:\n' +
            '    Lval:\n' +
            indentEach(this.base.toString(), 2) + '\n' +
            '    Rval:\n' +
            indentEach(this.value.toString(), 2);
};

exports.translate = function translate(ctx) {
    this.base = this.base.translate(ctx);
    this.value = this.value.translate(ctx);
    return this;
};
