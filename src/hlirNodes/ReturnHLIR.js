import BaseHLIR from './BaseHLIR';


export default class ReturnHLIR extends BaseHLIR {

    constructor(value, start, end) {
        super(start, end);
        this.value = value;
    }

    settleTypes(ctx) {
        var scopeReturnType = ctx.scope.returnType;
        if (scopeReturnType && !this.value) {
            throw this.TypeError('No value was returning when a return value was expected');
        }

        if (!scopeReturnType) {
            if (this.value) {
                throw this.TypeError('Returning value when no value was expected');
            }
            return;
        }

        var expectedReturnType = scopeReturnType.resolveType(ctx);
        var returnType = this.value.resolveType(ctx);
        if (!returnType.equals(expectedReturnType)) {
            throw this.TypeError('Attempted to return ' + returnType.toString() + ' but expected a ' + expectedReturnType.toString());
        }
    }

};
