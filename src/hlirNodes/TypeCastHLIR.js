import BaseExpressionHLIR from './BaseExpressionHLIR';


export default class TypeCastHLIR extends BaseExpressionHLIR {

    constructor(base, target, start, end) {
        super(start, end);
        this.base = base;
        this.target = target;
    }

};
