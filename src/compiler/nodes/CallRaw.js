var indentEach = require('./_utils').indentEach;
var oneArg = require('./_utils').oneArg;


exports.traverse = function traverse(cb) {
    cb(this.callee, 'callee');
    this.params.forEach(oneArg(cb));
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
    if (this.params.length < paramTypes.length) {
        throw new TypeError('Too few arguments passed to function call');
    } else if (this.params.length < paramTypes.length) {
        throw new TypeError('Too many arguments passed to function call');
    }
    for (var i = 0; i < this.params.length; i++) {
        if (!this.params[i].getType(ctx).equals(paramTypes[i])) {
            throw new TypeError('Wrong type passed as parameter to function call');
        }
    }
};

exports.__getName = function __getName() {
    return 'CallRaw';
};

exports.toString = function toString() {
    return this.__getName() + ':\n' +
           '    Base:\n' +
           indentEach(this.callee.toString(), 2) + '\n' +
           '    Args:\n' +
           indentEach(this.params.map(function(param) {return param.toString();}).join('\n'), 2) + '\n';
};
