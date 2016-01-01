import BaseBlockHLIR from './BaseBlockHLIR';
import BaseExpressionHLIR from './BaseExpressionHLIR';
import Func from '../compiler/types/Func';
import ReturnHLIR from './ReturnHLIR';
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
        this.checkReturnType(this[symbols.CONTEXT]);
        this.settleTypes();
    }


    resolveType(ctx) {
        if (this[TYPE_CACHE]) {
            return this[TYPE_CACHE];
        }
        this[TYPE_CACHE] = new Func(
            this.returnType ? this.returnType.resolveType(ctx) : null,
            this.params.map(p => p.resolveType(ctx))
        );
        this[symbols.CONTEXT] = this[symbols.CONTEXT] || ctx;
        return this[TYPE_CACHE];
    }

    checkReturnType(ctx) {
        var expectsReturn = !!this.returnType;
        var expectedReturnType;
        if (expectsReturn) {
            expectedReturnType = this.returnType.resolveType(ctx);
        }

        var returnsSeen = 0;

        this.traverseBodies(body => {
            for (var i = 0; i < body.length; i++) {
                let node = body[i];
                if (!(node instanceof ReturnHLIR)) continue;

                returnsSeen += 1;

                if (expectsReturn) {
                    if (!node.value) {
                        throw this.TypeError(
                            'Function expects return value, but value was not found.',
                            node.start,
                            node.end
                        );
                    } else {
                        let returnType = node.value.resolveType(ctx);
                        if (!returnType.equals(expectedReturnType)) {
                            throw this.TypeError(
                                `Function returns ${expectedReturnType}, but saw ${returnType} being returned.`,
                                node.start,
                                node.end
                            );
                        }
                    }
                } else if (node.value) {
                    throw this.TypeError(
                        'Value was returned in function that returns no value',
                        node.start,
                        node.end
                    );
                }
            }
        });

        if (expectsReturn && !returnsSeen) {
            throw this.TypeError(
                `Expected ${expectedReturnType} to be returned from function, but no returns found.`
            );
        }

    }

    settleTypes() {
        var ctx = this[symbols.CONTEXT];
        // this.params.forEach(p => p.resolveType(ctx));
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
