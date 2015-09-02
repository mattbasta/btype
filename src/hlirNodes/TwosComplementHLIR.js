import BaseExpressionHLIR from './BaseExpressionHLIR';
import * as symbols from '../symbols';


export default class TwosComplementHLIR extends BaseExpressionHLIR {

    constructor(base, start, end) {
        super(start, end);
        this.base = base;
    }

    resolveType(ctx) {
        var baseType = this.base.resolveType(ctx);
        if (baseType._type !== 'primitive' &&
            baseType.litType !== 'int') {
            throw this.TypeError('Cannot negate non-int type');
        }
        return baseType;
    }

};
