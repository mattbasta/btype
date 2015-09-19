import BaseExpressionHLIR from './BaseExpressionHLIR';
import * as symbols from '../symbols';


export default class NewHLIR extends BaseExpressionHLIR {

    constructor(base, args, start, end) {
        super(start, end);
        this.base = base;
        this.args = args;
    }

    resolveType(ctx, expectedReturn) {
        var baseType = this.base.resolveType(ctx);
        if (baseType._type === 'primitive') {
            throw this.TypeError('Cannot instantiate new primitive: ' + baseType);
        }
        if (baseType._type === 'struct') {
            if (this.args.length && !baseType.objConstructor) {
                throw this.TypeError('Parameters passed to object without constructor');
            }

            if (baseType.objConstructor) {
                let func = ctx.lookupFunctionByName(baseType.objConstructor);
                if (this.args.length !== func.params.length - 1) {
                    throw this.TypeError('Number of parameters passed to constructor does not match object constructor signature');
                }

                this.args.forEach((p, i) => {
                    var aType = func.params[i + 1].resolveType(func[symbols.CONTEXT]);
                    var pType = p.resolveType(ctx, aType);
                    if (!pType.equals(aType)) {
                        throw this.TypeError('Constructor parameter (' + i + ') type mismatch: ' + pType + ' != ' + aType);
                    }
                });

            }
        } else {
            this.args.forEach(p => p.resolveType(ctx));
        }

        if (expectedReturn && !expectedReturn.equals(baseType)) {
            throw this.TypeError('Mismatched return type: ' + expectedReturn + ' != ' + baseType);
        }

        return baseType;
    }

};

NewHLIR.asFuncRef = function asFuncRef(base, args, start, end) {
    var fr = new NewHLIR(base, args, start, end);
    fr[symbols.IS_FUNCREF] = true;
    return fr;
};
