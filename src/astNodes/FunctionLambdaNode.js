import BaseExpressionNode from './BaseExpressionNode';
import {Context} from '../compiler/context';
import Func from '../compiler/types/Func';
import FunctionHLIR from '../hlirNodes/FunctionHLIR';
import FunctionNode from './FunctionNode';
import ReturnHLIR from '../hlirNodes/ReturnHLIR';
import TypeHLIR from '../hlirNodes/TypeHLIR';
import TypedIdentifierHLIR from '../hlirNodes/TypedIdentifierHLIR';
import * as symbols from '../symbols';


const INFERRED_RETURN_TYPE = Symbol();

export default class FunctionLambdaNode extends BaseExpressionNode {
    constructor(params, body, start, end) {
        super(start, end);
        this.params = params;
        this.body = body;
    }

    get id() {
        return 12;
    }

    pack(bitstr) {
        super.pack(bitstr);
        bitstr.writebits(this.params.length, 32);
        this.body.pack(bitstr);
    }

    traverse(cb) {
        this.params.forEach(p => cb(p, 'params'));
        cb(this.body, 'body');
    }

    toString() {
        return `(${this.params.map(p => p.toString()).join(', ')}): ${this.body.toString()}`;
    }

    [symbols.FMAKEHLIR](builder, expectedType) {
        if (!expectedType) {
            throw new this.TypeError('Could not infer lambda function type');
        } else if (!(expectedType instanceof Func)) {
            throw new this.TypeError('Could not use lambda func where function is not expcted');
        } else if (!expectedType.returnType) {
            throw new this.TypeError('Inferred type does not expect a return value from lambda function');
        } else if (expectedType.args.length !== this.params.length) {
            throw new this.TypeError(`Lambda function expected inferred type with ${this.params.length} arguments, ${expectedType.args.length} found`);
        }

        var returnType = expectedType.returnType;
        this[INFERRED_RETURN_TYPE] = returnType;

        var paramNodes = this.params.map((p, i) => {
            return new TypedIdentifierHLIR(
                p.name,
                TypeHLIR.from(expectedType.args[i]),
                p.start,
                p.end
            );
        });

        var assignedName = builder.env.namer();

        var node = new FunctionHLIR(
            TypeHLIR.from(returnType),
            'anonymous',
            paramNodes,
            this.start,
            this.end
        );

        node[symbols.ASSIGNED_NAME] = assignedName;
        var ctx = builder.peekCtx();
        ctx.functions.add(node);
        ctx.functionDeclarations.set(assignedName, node);
        ctx.isFuncSet.add(assignedName);

        node[symbols.IS_FIRSTCLASS] = true;

        var newCtx = new Context(builder.env, node, ctx, builder.privileged);
        debugger;
        paramNodes.forEach(pn => {
            pn[symbols.ASSIGNED_NAME] = newCtx.addVar(pn.name, pn.resolveType(newCtx));
        });

        builder.addFunc(this, node);

        return node;
    }

    [symbols.FCONSTRUCT](builder, hlir) {
        var ctx = hlir[symbols.CONTEXT];
        builder.pushCtx(ctx);
        hlir.setBody([
            new ReturnHLIR(
                this.body[symbols.FMAKEHLIR](builder, this[INFERRED_RETURN_TYPE]),
                this.start,
                this.end
            ),
        ]);
        builder.processFuncs();
        hlir.settleTypes(ctx);
        builder.popCtx();
    }
};
