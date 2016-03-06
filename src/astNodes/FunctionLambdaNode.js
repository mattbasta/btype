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
            throw this.TypeError('Could not infer lambda function type');
        } else if (!(expectedType instanceof Func)) {
            throw this.TypeError('Could not use lambda func where function is not expcted');
        } else if (!expectedType.returnType) {
            throw this.TypeError('Inferred type does not expect a return value from lambda function');
        } else if (expectedType.args.length !== this.params.length) {
            throw this.TypeError(`Lambda function expected inferred type with ${this.params.length} arguments, ${expectedType.args.length} found`);
        }

        const returnType = expectedType.returnType;
        this[INFERRED_RETURN_TYPE] = returnType;

        const paramNodes = this.params.map((p, i) => {
            return new TypedIdentifierHLIR(
                p.name,
                TypeHLIR.from(expectedType.args[i]),
                p.start,
                p.end
            );
        });

        const assignedName = builder.env.namer();

        const node = new FunctionHLIR(
            TypeHLIR.from(returnType),
            'anonymous',
            paramNodes,
            this.start,
            this.end
        );

        node[symbols.ASSIGNED_NAME] = assignedName;
        const ctx = builder.peekCtx();
        ctx.functions.add(node);
        ctx.functionDeclarations.set(assignedName, node);
        ctx.isFuncSet.add(assignedName);

        // Even though these are technically always first-class from the
        // developer's perspective, they might just be uplifted and treated as
        // static closures.
        node[symbols.IS_FIRSTCLASS] = false;

        const newCtx = new Context(builder.env, node, ctx, builder.privileged);
        paramNodes.forEach(pn => {
            pn[symbols.ASSIGNED_NAME] = newCtx.addVar(pn.name, pn.resolveType(newCtx));
        });

        builder.addFunc(this, node);

        return node;
    }

    [symbols.FCONSTRUCT](builder, hlir) {
        const ctx = hlir[symbols.CONTEXT];
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
