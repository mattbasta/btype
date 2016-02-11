import BaseBlockNode from './BaseBlockNode';
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
    }

};
