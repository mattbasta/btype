import BaseHLIR from './BaseHLIR';


export default class AssignmentHLIR extends BaseHLIR {

    constructor(base, value, start, end) {
        super(start, end);
        this.base = base;
        this.value = value;
    }

    settleTypes(ctx) {
        var baseType = this.base.resolveType(ctx);
        var valueType = this.value.resolveType(ctx, baseType);
        if (!baseType.equals(valueType)) {
            throw this.TypeError(
                `Attempted to assign ${valueType} to variable declared as ${baseType}`
            );
        }
    }

};
