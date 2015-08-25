import BaseExpressionHLIR from './BaseExpressionHLIR';


export default class TupleLiteralHLIR extends BaseExpressionHLIR {

    constructor(elements, start, end) {
        super(start, end);
        this.elements = elements;
    }

};
