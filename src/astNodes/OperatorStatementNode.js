import BaseBlockNode from './BaseBlockNode';
import {Context} from '../compiler/context';
import FunctionHLIR from '../hlirNodes/FunctionHLIR';
import FunctionNode from './FunctionNode';
import * as symbols from '../symbols';


export default class OperatorStatementNode extends BaseBlockNode {
    constructor(returnType, left, operator, right, body, start, end) {
        super(start, end);

        this.returnType = returnType;
        this.left = left;
        this.operator = operator;
        this.right = right;
        this.body = body;
    }

    get id() {
        return 24;
    }

    pack(bitstr) {
        super.pack(bitstr);
        this.returnType.pack(bitstr);
        this.packStr(bitstr, this.operator); // TODO: Make this use a table like BinopNode?
        this.left.pack(bitstr);
        this.right.pack(bitstr);
        this.packBlock(bitstr, 'body');
    }

    traverse(cb) {
        cb(this.returnType, 'returnType');
        cb(this.right, 'right');
        cb(this.left, 'left');
        this.body.forEach(s => cb(s, 'body'));
    }

    toString() {
        return 'operator (' +
            this.left.toString() + ' ' +
            this.operator + ' ' +
            this.right.toString() + ') ' +
            this.returnType.toString() + ' {\n' +
            this.body.map(s => s.toString()).join('') +
            '}\n';
    }

    [symbols.FMAKEHLIR](builder) {
        const returnTypeNode = this.returnType[symbols.FMAKEHLIR](builder);
        const paramNodes = [
            this.left[symbols.FMAKEHLIR](builder),
            this.right[symbols.FMAKEHLIR](builder),
        ];

        const assignedName = builder.env.namer();
        const node = new FunctionHLIR(
            returnTypeNode,
            assignedName,
            paramNodes,
            this.start,
            this.end
        );
        node[symbols.ASSIGNED_NAME] = assignedName;
        const ctx = builder.peekCtx();
        ctx.functions.add(node);
        ctx.addVar(node.name, node.resolveType(ctx), assignedName);
        ctx.functionDeclarations.set(assignedName, node);
        ctx.isFuncSet.add(assignedName);

        node[symbols.IS_FIRSTCLASS] = false;
        node[symbols.ORIG_OPERATOR] = this.operator;

        const newCtx = new Context(builder.env, node, ctx, builder.privileged);
        paramNodes.forEach(pn => {
            pn[symbols.ASSIGNED_NAME] = newCtx.addVar(pn.name, pn.resolveType(newCtx));
        });

        builder.addFunc(this, node);
        builder.addOpOverload(node);

        return node;

    }

    [symbols.FCONSTRUCT](builder, hlir) {
        return FunctionNode.prototype[symbols.FCONSTRUCT].call(this, builder, hlir);
    }

};
