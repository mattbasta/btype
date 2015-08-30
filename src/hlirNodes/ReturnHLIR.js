import BaseHLIR from './BaseHLIR';


export default class ReturnHLIR extends BaseHLIR {

    constructor(value, start, end) {
        super(start, end);
        this.value = value;
    }

    settleTypes(ctx) {
        var scopeReturnType = ctx.scope.returnType;
        if (scopeReturnType && !this.value) {
            throw new TypeError('No value was returning when a return value was expected');
        }
        if (!scopeReturnType && this.value) {
            throw new TypeError('Returning value when no value was expected');
        }
        var expectedReturnType = scopeReturnType.resolveType(ctx);
        var returnType = this.value.resolveType(ctx);
        if (!returnType.equals(expectedReturnType)) {
            throw new TypeError('Attempted to return ' + returnType.toString() + ' but expected a ' + expectedReturnType.toString());
        }
    }

};
