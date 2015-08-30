import BaseExpressionHLIR from './BaseExpressionHLIR';
import LiteralHLIR from './LiteralHLIR';


export default class SubscriptHLIR extends BaseExpressionHLIR {

    constructor(base, childExpr, start, end) {
        super(start, end);
        this.base = base;
        this.childExpr = childExpr;
    }

    resolveType(ctx) {
        var baseType = this.base.resolveType(ctx);
        var childExprType = this.childExpr.resolveType(ctx);

        var temp;
        if ((temp = ctx.env.registeredOperators.get(baseType.flatTypeName())) &&
            (temp = temp.get(subscriptType.flatTypeName())) &&
            (temp = temp.get('[]'))) {

            return ctx.env.registeredOperatorReturns.get(temp);
        }

        if (!(this.childExpr instanceof LiteralHLIR) ||
            this.childExpr.litType !== 'int') {
            throw this.TypeError('Cannot subscript built-in types with non-static ints');
        }

        return baseType.getMemberType(this.child);
    }

};
