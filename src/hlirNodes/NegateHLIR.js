import BaseExpressionHLIR from './BaseExpressionHLIR';
import * as symbols from '../symbols';


export default class NegateHLIR extends BaseExpressionHLIR {

    constructor(base, start, end) {
        super(start, end);
        this.base = base;
    }

    resolveType(ctx) {
        const baseType = this.base.resolveType(ctx);
        if (baseType._type !== 'primitive' &&
            baseType.litType !== 'bool') {
            throw this.TypeError('Cannot negate non-bool type');
        }
        return baseType;
    }

};
