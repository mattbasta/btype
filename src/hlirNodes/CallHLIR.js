import BaseExpressionHLIR from './BaseExpressionHLIR';


export default class CallHLIR extends BaseExpressionHLIR {

    constructor(callee, params, start, end) {
        super(start, end);
        this.callee = callee;
        this.params = params;
    }

    resolveType(ctx, expectedReturn) {
        var baseType = this.callee.resolveType(ctx);
        if (baseType._type !== 'func') {
            console.log(this.callee);
            throw this.TypeError('Cannot call non-func type: ' + baseType);
        }
        if (baseType.args.length !== this.params.length) {
            throw this.TypeError('Cannot call func with wrong number of args: ' + baseType.args.length + ' != ' + this.params.length);
        }

        this.params.forEach((p, i) => {
            var pType = p.resolveType(ctx, baseType.args[i]);
            if (!pType.equals(baseType.args[i])) {
                throw this.TypeError('Parameter type mismatch: ' + pType + ' != ' + baseType.args[i]);
            }
        });

        if (expectedReturn) {
            if (!baseType.returnType) {
                throw this.TypeError('Expected return value (' + expectedReturn + ') from void function');
            }
            if (!expectedReturn.equals(baseType.returnType)) {
                throw this.TypeError('Mismatched return type: ' + expectedReturn + ' != ' + baseType.returnType);
            }
        }

        return baseType.returnType;
    }

};
