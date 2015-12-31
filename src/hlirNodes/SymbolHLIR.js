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

    asString() {
        var output = `SymbolHLIR(${this.name || '<unnamed>'})`;

        if (this[symbols.REFNAME]) {
            output += ` for ${this[symbols.REFNAME]}`;
        }

        return output;
    }

};
