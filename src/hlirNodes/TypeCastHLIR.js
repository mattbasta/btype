import BaseExpressionHLIR from './BaseExpressionHLIR';


export default class TypeCastHLIR extends BaseExpressionHLIR {

    constructor(base, target, start, end) {
        super(start, end);
        this.base = base;
        this.target = target;
    }

    resolveType(ctx, expectedType) {
        var baseType = this.base.resolveType(ctx);
        var targetType = this.target.resolveType(ctx);
        if (expectedType && !expectedType.equals(targetType)) {
            throw this.TypeError(`${baseType} was found where ${expectedType} was expected`);
        }
        return targetType;
    }

};
