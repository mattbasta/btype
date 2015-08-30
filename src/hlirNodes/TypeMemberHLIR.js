import BaseHLIR from './BaseHLIR';


export default class TypeMemberHLIR extends BaseHLIR {

    constructor(base, child, attributes, start, end) {
        super(start, end);
        this.base = base;
        this.child = child;
        this.attributes = attributes;
    }

    resolveType(ctx) {
        var baseType = this.base.resolveType(ctx);
        if (!baseType.hasType(this.child)) {
            throw this.TypeError('Requesting incompatible type (' + this.child + ') from ' + this.base.toString());
        }

        return baseType.getTypeOf(
            this.child,
            this.attributes.map(a => a.resolveType(ctx))
        );
    }

};
