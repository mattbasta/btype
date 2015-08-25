import BaseExpressionHLIR from './BaseExpressionHLIR';


export default class LiteralHLIR extends BaseExpressionHLIR {

    constructor(litType, value, start, end) {
        super(start, end);
        this.litType = litType;
        this.value = value;
    }

};
