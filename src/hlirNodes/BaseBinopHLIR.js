import BaseExpressionHLIR from './BaseExpressionHLIR';


export default class BaseBinopHLIR extends BaseExpressionHLIR {

    isOverloaded(ctx) {
        var leftType = this.left.resolveType(ctx).flatTypeName();
        var rightType = this.right.resolveType(ctx).flatTypeName();
        return ctx.env.registeredOperators.has(leftType) &&
               ctx.env.registeredOperators.get(leftType).has(rightType) &&
               ctx.env.registeredOperators.get(leftType).get(rightType).has(this.operator);
    }

};
