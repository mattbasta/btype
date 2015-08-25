import BaseExpressionHLIR from './BaseExpressionHLIR';
import Func from '../compiler/types/Func';


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
        return new Func(
            this.returnType ? this.returnType.resolveType(ctx) : null,
            this.params.map(p => p.resolveType(ctx))
        );
    }

};
