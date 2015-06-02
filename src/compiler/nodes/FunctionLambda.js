var Function = require('./Function')
var ident = require('./_utils').ident;
var indentEach = require('./_utils').indentEach;
var types = require('../types');


exports.traverse = Function.traverse;
exports.traverseStatements = Function.traverseStatements;
exports.substitute = Function.substitute;
exports.validateTypes = Function.validateTypes;
exports.toString = Function.toString;


exports.getType = function getType(ctx, inheritedType) {
    if (!inheritedType) {
        throw new TypeError('Lambda functions cannot rely on type inference.');
    }

    if (!(inheritedType instanceof types.Func)) {
        throw new TypeError('Lambda function passed where ' + inheritedType.toString() + ' expected');
    }

    var actualReturnType = this.body[0].value.getType(this.__context);
    var inheritedReturnType = inheritedType.returnType;
    if (actualReturnType && !actualReturnType.equals(inheritedReturnType)) {
        throw new TypeError(
            'Type mismatch between inherited and actual return values: ' +
            (inheritedReturnType ? inheritedReturnType.toString() : 'null') +
            ' != ' +
            (actualReturnType ? actualReturnType.toString() : 'null')
        );
    } else if (!actualReturnType && !(actualReturnType instanceof types.Primitive)) {
        throw new TypeError('Cannot return `null` from lambda function where primitive is expected.');
    }

    if (inheritedType.args.length !== this.params.length) {
        throw new TypeError(
            'Lambda function param count does not match inherited type: ' +
            inheritedType.args.length + ' != ' + this.params.length
        );
    }

    return inheritedType;

};

exports.translate = function translate() {
    if (this.returnType) this.returnType = this.returnType.translate();
    this.params = this.params.map(function(p) {
        return p.translate();
    });
    this.body = this.body.map(function(s) {
        return s.translate();
    });
    return this;
};
