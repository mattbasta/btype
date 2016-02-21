import BaseBlockNode from './BaseBlockNode';
import CatchNode from './CatchNode';
import {Context} from '../compiler/context';
import FinallyNode from './FinallyNode';
import FunctionHLIR from '../hlirNodes/FunctionHLIR';
import * as symbols from '../symbols';


export default class FunctionNode extends BaseBlockNode {
    constructor(returnType, name, params, body, start, end) {
        super(start, end);

        this.setFlag('DECLARES_SOMETHING');

        this.returnType = returnType;
        this.name = name;
        this.params = params;
        this.body = body;
    }

    get id() {
        return 13;
    }

    pack(bitstr) {
        super.pack(bitstr);
        bitstr.writebits(this.returnType ? 1 : 0, 1);
        if (this.returnType) this.returnType.pack(bitstr);
        bitstr.writebits(this.params.length, 32);
        this.params.forEach(p => p.pack(bitstr));
        this.packBlock(bitstr, 'body');
    }

    traverse(cb) {
        if (this.returnType) cb(this.returnType, 'returnType');
        this.params.forEach(p => cb(p, 'params'));
        this.body.forEach(s => cb(s, 'body'));
    }

    toString() {
        return (this.returnType ? this.returnType.toString() + ':' : '') +
            'func' +
            (this.name ? ' ' + this.name : '') +
            '(' + this.params.map(p => p.toString()).join(', ') +
            ') {\n' +
            this.body.map(s => s.toString()).join('') +
            '}\n';
    }

    [symbols.FMAKEHLIR](builder) {
        var returnTypeNode = this.returnType ? this.returnType[symbols.FMAKEHLIR](builder) : null;
        var paramNodes = this.params.map(p => p[symbols.FMAKEHLIR](builder));

        var assignedName = builder.env.namer();
        var name = this.name || assignedName;

        var node = new FunctionHLIR(
            returnTypeNode,
            name,
            paramNodes,
            this.start,
            this.end
        );

        node[symbols.ASSIGNED_NAME] = assignedName;
        var ctx = builder.peekCtx();
        ctx.functions.add(node);
        ctx.addVar(node.name, node.resolveType(ctx), assignedName);
        ctx.functionDeclarations.set(assignedName, node);
        ctx.isFuncSet.add(assignedName);

        node[symbols.IS_FIRSTCLASS] = false;

        var newCtx = new Context(builder.env, node, ctx, builder.privileged);
        paramNodes.forEach(pn => {
            pn[symbols.ASSIGNED_NAME] = newCtx.addVar(pn.name, pn.resolveType(newCtx));
        });

        builder.addFunc(this, node);

        return node;
    }

    [symbols.FCONSTRUCT](builder, hlir) {
        var ctx = hlir[symbols.CONTEXT];
        builder.pushCtx(ctx);

        var exceptBlockFreeBody = this.body.filter(
            x => !(x instanceof CatchNode || x instanceof FinallyNode)
        );
        var exceptBlocks = this.body.slice(exceptBlockFreeBody.length);
        var catches = exceptBlocks.filter(x => x instanceof CatchNode);
        var finally_ = (exceptBlocks.length &&
                        exceptBlocks[exceptBlocks.length - 1] instanceof FinallyNode) ?
                            exceptBlocks[exceptBlocks.length - 1] :
                            null;

        hlir.setBody(this[symbols.FMAKEHLIRBLOCK](builder, exceptBlockFreeBody));
        hlir.catches = catches.map(c => c[symbols.FMAKEHLIR](builder));
        if (finally_) {
            hlir.finally = finally_[symbols.FMAKEHLIR](builder);
        }

        builder.processFuncs();
        hlir.settleTypes(ctx);
        builder.popCtx();
    }

};
