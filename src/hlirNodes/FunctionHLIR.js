import BaseBlockHLIR from './BaseBlockHLIR';
import BaseExpressionHLIR from './BaseExpressionHLIR';
import Func from '../compiler/types/Func';
import * as symbols from '../symbols';


const TYPE_CACHE = Symbol();

export default class FunctionHLIR extends BaseExpressionHLIR {

    constructor(returnType, name, params, start, end) {
        super(start, end);
        this.returnType = returnType;
        this.params = params;
        this.name = name;
        this.body = null;
    }

    setBody(body) {
        this.body = body;
    }


    resolveType(ctx) {
        if (this[TYPE_CACHE]) {
            return this[TYPE_CACHE];
        }
        return this[TYPE_CACHE] = new Func(
            this.returnType ? this.returnType.resolveType(ctx) : null,
            this.params.map(p => p.resolveType(ctx))
        );
    }

    settleTypes() {
        var ctx = this[symbols.CONTEXT];
        this.params.forEach(p => p.resolveType(ctx));
        BaseBlockHLIR.prototype.settleTypesForArr.call(this, ctx, this.body);
    }

    asString() {
        var output = `FunctionHLIR(${this.name}:${this[symbols.ASSIGNED_NAME]})`;

        if (this[symbols.IS_FIRSTCLASS]) {
            output += '[firstclass]';
        }

        return output;
    }

};
