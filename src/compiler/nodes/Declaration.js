var indentEach = require('./_utils').indentEach;


exports.traverse = function traverse(cb) {
    if (this.declType) cb(this.declType, 'type');
    cb(this.value, 'value');
};

exports.substitute = function substitute(cb) {
    this.value = cb(this.value, 'value') || this.value;
};

exports.getType = function getType(ctx) {
    return this.__staticType || (this.declType || this.value).getType(ctx);
};

exports.validateTypes = function validateTypes(ctx) {
    this.value.validateTypes(ctx, this);

    if (this.value.type === 'Literal' &&
        this.value.value === null) {

        if (!this.declType) {
            throw new TypeError('Cannot create variable containing null without a type');
        }
        // TODO: check that declType is not null?
        return;
    }

    if (!this.declType) {
        if (this.value.getType(ctx) === null) {
            throw new TypeError('Declaration with no type information');
        }

        this.__staticType = this.value.getType(ctx);
        return;
    }
    var declType = this.declType.getType(ctx);
    var valueType = this.value.getType(ctx);
    if (!valueType.equals(declType)) {
        throw new TypeError('Mismatched types in declaration: ' + declType.toString() + ' != ' + valueType.toString());
    }
};

exports.toString = function toString() {
    return 'Declaration(' + this.identifier + (this.__assignedName ? '::' + this.__assignedName : '') + ')\n' +
           (!this.declType ? '' :
               '    Type:\n' +
               indentEach(this.declType.toString(), 2) + '\n'
            ) +
           '    Value:\n' +
           indentEach(this.value.toString(), 2);
};
