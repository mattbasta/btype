import BaseBlockNode from './BaseBlockNode';
import {RootContext} from '../compiler/context';
import ContextBuilder from '../contextBuilder';
import RootHLIR from '../hlirNodes/RootHLIR';
import * as symbols from '../symbols';


export default class RootNode extends BaseBlockNode {
    constructor(body, start, end) {
        super(start, end);
        this.body = body;
        this.name = '<root>';
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

    [symbols.FMAKEHLIR](env, privileged, errorFormatter, filename = null) {
        const builder = new ContextBuilder(env, privileged, errorFormatter);
        const rootHLIR = new RootHLIR(this.start, this.end);
        const rootCtx = new RootContext(env, rootHLIR, privileged);
        rootCtx.filename = filename;

        builder.pushCtx(rootCtx);
        rootHLIR.setBody(this[symbols.FMAKEHLIRBLOCK](builder, this.body));

        if (this[symbols.IGNORE_ERRORS]) {
            builder.getFuncs().forEach(b => {
                b[1][symbols.IGNORE_ERRORS] = true;
            });
        }

        builder.processFuncs();

        builder.popCtx();

        return rootHLIR;
    }

};
