import Array_ from '../compiler/types/Array';
import BaseExpressionHLIR from './BaseExpressionHLIR';
import LiteralHLIR from './LiteralHLIR';


export default class SubscriptHLIR extends BaseExpressionHLIR {

    constructor(base, childExpr, start, end) {
        super(start, end);
        this.base = base;
        this.childExpr = childExpr;
    }

    resolveType(ctx) {
        const baseType = this.base.resolveType(ctx);
        const childExprType = this.childExpr.resolveType(ctx);

        const temp = ctx.env.getOverloadReturnType(baseType, childExprType, '[]');
        if (temp) {
            return temp;
        }

        if (!(baseType instanceof Array_) &&
            (!(this.childExpr instanceof LiteralHLIR) || this.childExpr.litType !== 'int')) {
            throw this.TypeError('Cannot subscript built-in types with non-static ints');
        }

        return baseType.getSubscriptType(this.childExpr.value);
    }

};
