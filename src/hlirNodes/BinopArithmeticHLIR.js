import BaseExpressionHLIR from './BaseExpressionHLIR';


export default class BinopArithmeticHLIR extends BaseExpressionHLIR {

    constructor(left, operator, right, start, end) {
        super(start, end);
        this.left = left;
        this.operator = operator;
        this.right = right;
    }

};
