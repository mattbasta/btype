import BaseBlockNode from './BaseBlockNode';
import * as symbols from '../symbols';


export default class FinallyNode extends BaseBlockNode {
    constructor(body, start, end) {
        super(start, end);
        this.body = body;
    }

    get id() {
        return 39;
    }

    pack(bitstr) {
        super.pack(bitstr);
        this.packBlock(bitstr, 'body');
    }

    traverse(cb) {
        this.body.forEach(s => cb(s, 'body'));
    }

    toString() {
        return `finally {\n` +
            this.body.map(s => s.toString()).join('\n') +
            '}\n';
    }

    [symbols.FMAKEHLIR](builder) {
    }

};
