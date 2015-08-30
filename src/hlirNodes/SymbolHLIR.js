import BaseExpressionHLIR from './BaseExpressionHLIR';
import * as symbols from '../symbols';


export default class SymbolHLIR extends BaseExpressionHLIR {

    constructor(name, start, end) {
        super(start, end);
        this.name = name;
    }

    resolveType() {
        return this[symbols.REFTYPE];
    }

};
