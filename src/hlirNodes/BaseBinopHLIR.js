import BaseExpressionHLIR from './BaseExpressionHLIR';


export default class BaseBinopHLIR extends BaseExpressionHLIR {

    isOverloaded(ctx) {
        var leftType = this.left.resolveType(ctx);
        var rightType = this.right.resolveType(ctx);
        return ctx.env.getOverloadReturnType(leftType, rightType, this.operator) !== null;
    }

};
