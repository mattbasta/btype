import BaseBlockNode from './BaseBlockNode';
import {Context} from '../compiler/context';
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
        cb(this.returnType, 'returnType');
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

        var name = this.name || builder.env.namer();

        var node = new FunctionHLIR(
            returnTypeNode,
            name,
            paramNodes,
            this.start,
            this.end
        );
        var ctx = builder.peekCtx();
        ctx.functions.add(node);
        var assignedName = ctx.addVar(node.name, node.resolveType(ctx), node[symbols.ASSIGNED_NAME]);
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
        builder.pushCtx(hlir[symbols.CONTEXT]);
        hlir.setBody(this[symbols.FMAKEHLIRBLOCK](builder, this.body));
        builder.processFuncs();
        builder.popCtx();
    }

};
