import BaseExpressionHLIR from './BaseExpressionHLIR';


export default class MemberHLIR extends BaseExpressionHLIR {

    constructor(base, child, start, end) {
        super(start, end);
        this.base = base;
        this.child = child;
    }

    resolveType(ctx) {
        var baseType = this.base.resolveType(ctx)
        if (baseType.hasMethod(this.child)) {
            return baseType.getMethodType(this.child, ctx);
        }

        if (!baseType.hasMember(this.child)) {
            throw this.TypeError(`Member not found for type "${baseType}": ${this.child}`);
        }

        return baseType.getMemberType(this.child);
    }

};
