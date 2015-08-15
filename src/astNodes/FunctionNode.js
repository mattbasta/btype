import BaseBlockNode from './BaseBlockNode';


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

};
