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

        this.catches = [];
        this.finally = null;
    }

    setBody(body) {
        this.body = body;
        this.checkReturnType(this[symbols.CONTEXT]);
    }

    resolveType(ctx) {
        if (this[TYPE_CACHE]) {
            return this[TYPE_CACHE];
        }

        const result = this[TYPE_CACHE] = new Func(
            this.returnType ? this.returnType.resolveType(ctx) : null,
            this.params.map((p, i) => {
                const type = p.resolveType(ctx).clone();
                if (i === 0 && this[symbols.IS_METHOD]) {
                    type[symbols.IS_SELF_PARAM] = true;
                }
                return type;
            })
        );
        if (this[symbols.IS_METHOD]) {
            result[symbols.IS_METHOD] = true;
        }
        this[symbols.CONTEXT] = this[symbols.CONTEXT] || ctx;
        return result;
    }
    clearTypeCache() {
        delete this[TYPE_CACHE];
    }

    checkReturnType(ctx) {
        if (this[symbols.IGNORE_ERRORS]) {
            return;
        }

        const expectsReturn = !!this.returnType;
        const expectedReturnType = expectsReturn ? this.returnType.resolveType(ctx) : null;

        let returnsSeen = 0;
        this.iterateBodies(body => {
            for (let node of body) {
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
        }, null, node => !(node instanceof FunctionHLIR) || node === this);

        if (expectsReturn && !returnsSeen) {
            throw this.TypeError(
                `Expected ${expectedReturnType} to be returned from function, but no returns found.`
            );
        }

    }

    settleTypes() {
        const ctx = this[symbols.CONTEXT];
        // this.params.forEach(p => p.resolveType(ctx));
        BaseBlockHLIR.prototype.settleTypesForArr.call(this, ctx, this.body);
    }

    asString() {
        let output = `FunctionHLIR(${this.name}:${this[symbols.ASSIGNED_NAME]})`;

        if (this[symbols.IS_FIRSTCLASS]) {
            output += '[firstclass]';
        }

        return output;
    }

    hasMatchingNodeExceptLastReturn(test) {
        let body = this.body;
        if (body[body.length - 1] instanceof ReturnHLIR) {
            body = body.slice(0, body.length - 1);
        }
        return body.some(node => test(node) || node.hasMatchingNode(test));
    }

};
