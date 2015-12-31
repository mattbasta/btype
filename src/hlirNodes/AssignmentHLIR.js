import BaseHLIR from './BaseHLIR';
import * as symbols from '../symbols';


export default class AssignmentHLIR extends BaseHLIR {

    constructor(base, value, start, end) {
        super(start, end);
        this.base = base;
        this.value = value;
    }

    settleTypes(ctx) {
        var baseType = this.base.resolveType(ctx);

        if (baseType[symbols.IS_METHOD]) {
            throw this.TypeError(
                'Attempted to assign a value to a class method, which is not allowed.'
            );
        }

        var valueType = this.value.resolveType(ctx, baseType);
        if (!baseType.equals(valueType)) {
            throw this.TypeError(
                `Attempted to assign ${valueType} to variable declared as ${baseType}`
            );
        }
    }

};
