import BaseExpressionHLIR from './BaseExpressionHLIR';
import * as symbols from '../symbols';


export default class CallHLIR extends BaseExpressionHLIR {

    constructor(callee, params, start, end) {
        super(start, end);
        this.callee = callee;
        this.params = params;
    }

    resolveType(ctx, expectedReturn) {
        var baseType = this.callee.resolveType(ctx);
        if (baseType._type !== 'func' &&
            baseType._type !== '_foreign_curry') {
            throw this.TypeError('Cannot call non-func type: ' + baseType);
        }

        if (baseType._type === '_foreign_curry') {
            return baseType.getReturnType();
        }

        var expectedParamCount = baseType.args.length;

        var receivedParams = this.params.slice(0);
        var receivedParamCount = receivedParams.length;

        var isMethod = baseType[symbols.IS_METHOD];
        if (isMethod) {
            expectedParamCount--;
        }
        if (receivedParamCount === expectedParamCount + 1 && this.params[0].resolveType(ctx)[symbols.IS_CTX_OBJ]) {
            receivedParamCount--;
            receivedParams = receivedParams.slice(1);
        }

        if (expectedParamCount !== receivedParamCount) {
            throw this.TypeError(`Cannot call func with wrong number of args: ${baseType.args.length} != ${this.params.length}`);
        }

        receivedParams.forEach((p, i) => {
            var pType = p.resolveType(ctx, baseType.args[i]);
            var paramIdx = i;

            if (isMethod) {
                // If this is a method call, the first param is the self
                // reference, which we don't need to check.
                paramIdx += 1;
            }

            if (!pType.equals(baseType.args[paramIdx])) {
                throw this.TypeError(
                    `Type mismatch: ${pType} != ${baseType.args[i]} for parameter ${i} of call`,
                    p.start,
                    p.end
                );
            }
        });

        if (expectedReturn) {
            if (!baseType.returnType) {
                throw this.TypeError(`Expected return value (${expectedReturn}) from void function`);
            }
            if (!expectedReturn.equals(baseType.returnType)) {
                throw this.TypeError(`Mismatched return type: ${expectedReturn} != ${baseType.returnType}`);
            }
        }

        return baseType.returnType;
    }

};
