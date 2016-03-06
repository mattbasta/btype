import BaseBlockNode from './BaseBlockNode';
import {CatchHLIR} from '../hlirNodes';
import {Context} from '../compiler/context';
import * as symbols from '../symbols';


export default class CatchNode extends BaseBlockNode {
    constructor(ident, body, start, end) {
        super(start, end);
        this.ident = ident;
        this.body = body;
    }

    get id() {
        return 38;
    }

    pack(bitstr) {
        super.pack(bitstr);
        bitstr.writebits(this.ident ? 1 : 0, 1);
        if (this.ident) this.ident.pack(bitstr);
        this.packBlock(bitstr, 'body');
    }

    traverse(cb) {
        if (this.ident) {
            cb(this.ident, 'ident');
        }
        this.body.forEach(s => cb(s, 'body'));
    }

    toString() {
        return `catch ${this.ident ? ` ${this.ident.toString()}` : ''}{\n` +
            this.body.map(s => s.toString()).join('\n') +
            '}\n';
    }

    [symbols.FMAKEHLIR](builder) {
        const catchNode = new CatchHLIR(
            this.ident ? this.ident[symbols.FMAKEHLIR](builder) : null,
            this.start,
            this.end
        );

        const ctx = builder.peekCtx();
        const newCtx = new Context(builder.env, catchNode, ctx, builder.privileged);
        if (this.ident) {
            const errorType = builder.rootCtx().resolveType('error');
            catchNode.ident[symbols.ASSIGNED_NAME] = newCtx.addVar(this.ident.name, errorType);
        }

        catchNode[symbols.CONTEXT] = newCtx;

        builder.pushCtx(newCtx);
        catchNode.setBody(this[symbols.FMAKEHLIRBLOCK](builder, this.body));
        builder.popCtx();

        catchNode.settleTypes();

        return catchNode;
    }

};
