import BaseBinopHLIR from './BaseBinopHLIR';


export default class BinopArithmeticHLIR extends BaseBinopHLIR {

    constructor(left, operator, right, start, end) {
        super(start, end);
        this.left = left;
        this.operator = operator;
        this.right = right;
    }

    resolveType(ctx) {
        var leftType = this.left.resolveType(ctx);
        var rightType = this.right.resolveType(ctx);

        var overloadType = ctx.env.getOverloadReturnType(leftType, rightType, this.operator);

        if (!overloadType && !leftType.equals(rightType)) {
            throw new TypeError('Cannot convert ' + leftType.toString() + ' to ' + rightType.toString() + ' for "' + this.operator + '"');
        }

        return overloadType || leftType;
    }

};
