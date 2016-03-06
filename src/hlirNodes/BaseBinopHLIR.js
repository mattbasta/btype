import BaseExpressionHLIR from './BaseExpressionHLIR';


export default class BaseBinopHLIR extends BaseExpressionHLIR {

    isOverloaded(ctx) {
        const leftType = this.left.resolveType(ctx);
        const rightType = this.right.resolveType(ctx);
        return ctx.env.getOverloadReturnType(leftType, rightType, this.operator) !== null;
    }

};
