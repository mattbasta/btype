import BaseExpressionHLIR from './BaseExpressionHLIR';


export default class SymbolHLIR extends BaseExpressionHLIR {

    constructor(name, start, end) {
        super(start, end);
        this.name = name;
    }

};
