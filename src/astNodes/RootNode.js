import BaseBlockNode from './BaseBlockNode';
import {RootContext} from '../compiler/context';
import ContextBuilder from '../contextBuilder';
import RootHLIR from '../hlirNodes/RootHLIR';
import * as symbols from '../symbols';


export default class RootNode extends BaseBlockNode {
    constructor(body, start, end) {
        super(start, end);
        this.body = body;
    }

    get id() {
        return 26;
    }

    pack(bitstr) {
        super.pack(bitstr);
        this.packBlock(bitstr, 'body');
    }

    traverse(cb) {
        this.body.forEach(e => {
            cb(e, 'body');
        });
    }

    toString() {
        return this.body.map(e => e.toString()).join('');
    }

    [symbols.FMAKEHLIR](env, privileged) {
        var builder = new ContextBuilder(env, privileged);
        var rootHLIR = new RootHLIR(this.start, this.end);
        var rootCtx = new RootContext(env, rootHLIR, privileged);

        builder.pushCtx(rootCtx);
        rootHLIR.setBody(this[symbols.FMAKEHLIRBLOCK](builder, this.body));

        builder.processFuncs();

        builder.popCtx();

        return rootHLIR;
    }

};
