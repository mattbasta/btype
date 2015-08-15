import BaseBlockNode from './BaseBlockNode';


export default class ObjectConstructorNode extends BaseBlockNode {
    constructor(params, body, isFinal, start, end) {
        super(start, end);

        this.params = params;
        this.body = body;
        this.isFinal = isFinal;
    }

    get id() {
        return 19;
    }

    pack(bitstr) {
        super.pack(bitstr);
        bitstr.writebits(this.params.length, 32);
        bitstr.writebits(this.isFinal, 1);
        this.params.forEach(p => p.pack(bitstr));
        this.packBlock(bitstr, 'body');
    }

    traverse(cb) {
        this.params.forEach(p => cb(p, 'params'));
        this.body.forEach(s => cb(s, 'body'));
    }

    toString() {
        return 'new(' + this.params.map(p => p.toString()).join(', ') + ') {\n' +
            this.body.map(s => s.toString()).join('') +
            '}\n';
    }

};
