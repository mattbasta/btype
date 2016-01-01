import BaseExpressionHLIR from './BaseExpressionHLIR';
import {resolve} from '../compiler/types';


export default class LiteralHLIR extends BaseExpressionHLIR {

    constructor(litType, value, start, end) {
        super(start, end);
        this.litType = litType;
        this.value = value;
    }

    resolveType() {
        return resolve(this.litType, true);
    }

    asString() {
        var value = this.value !== null ? this.value : 'null';
        return `LiteralHLIR(${this.litType}:${value.toString()})`;
    }

};
