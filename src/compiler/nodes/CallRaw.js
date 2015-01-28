var ident = require('./_utils').ident;
var indentEach = require('./_utils').indentEach;


exports.traverse = function traverse(cb) {
    cb(this.callee, 'callee');
    this.params.forEach(function(param) {
        cb(param, 'params');
    });
};

exports.substitute = function substitute(cb) {
    this.callee = cb(this.callee, 'callee') || this.callee;
    this.params = this.params.map(function(stmt) {
        return cb(stmt, 'params');
    }).filter(ident);
};

exports.getType = function getType(ctx) {
    return this.callee.getType(ctx).getReturnType();
};

exports.validateTypes = function validateTypes(ctx) {
    this.callee.validateTypes(ctx);
    this.params.forEach(function(p) {p.validateTypes(ctx);});

    var base = this.callee.getType(ctx);

    // Ignore type checking on external (foreign) functions.
    if (base._type === '_stdlib') {
        return;
    }

    if (base._type !== 'func' && base._type !== '_foreign_curry') {
        throw new Error('Call to non-executable type: ' + base.toString());
    }

    var paramTypes = base.getArgs();
    var signatureLength = paramTypes.length + signatureOffset;
    // Ignore the `self` parameter on object methods
    if (base.__isObjectMethod) {
        signatureLength--;
    }

    if (this.params.length < signatureLength) {
        throw new TypeError('Too few arguments passed to function call: ' + this.params.length + ' != ' + signatureLength);
    } else if (this.params.length > signatureLength) {
        throw new TypeError('Too many arguments passed to function call: ' + this.params.length + ' != ' + signatureLength);
    }

    var signatureOffset = base.__isObjectMethod ? 1 : 0;
    for (var i = 0; i < this.params.length; i++) {
        if (!this.params[i].getType(ctx).equals(paramTypes[i + signatureOffset])) {
            throw new TypeError(
                'Wrong type passed as parameter to function call: ' +
                this.params[i].getType(ctx).toString() + ' != ' + paramTypes[i + signatureOffset].toString() +
                '\nnear char ' + this.start
            );
        }
    }
};

exports.__getName = function __getName() {
    return 'CallRaw';
};

exports.toString = function toString() {
    return this.__getName() + ':\n' +
           '    Callee:\n' +
           indentEach(this.callee.toString(), 2) + '\n' +
           '    Args:\n' +
           indentEach(this.params.map(function(param) {return param.toString();}).join('\n'), 2) + '\n';
};
