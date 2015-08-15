import BaseBlockNode from './BaseBlockNode';


export default class ObjectMethodNode extends BaseBlockNode {
    constructor(returnType, name, params, body, isFinal, isPrivate, start, end) {
        super(start, end);

        this.isPrivate = isPrivate;
        this.isFinal = isFinal;
        this.returnType = returnType;
        this.name = name;
        this.params = params;
        this.body = body;
    }

    get id() {
        return 22;
    }

    pack(bitstr) {
        super.pack(bitstr);
        bitstr.writebits(this.params.length, 32);
        bitstr.writebits(this.isPrivate, 1);
        bitstr.writebits(this.isFinal, 1);
        bitstr.writebits(this.returnType ? 1 : 0, 1);
        if (this.returnType) this.returnType.pack(bitstr);
        this.packStr(bitstr, this.name);
        this.params.forEach(p => p.pack(bitstr));
        this.packBlock(bitstr, 'body');
    }

    traverse(cb) {
        if (this.returnType) {
            cb(this.returnType, 'returnType');
        }
        this.params.forEach(p => cb(p, 'params'));
        this.body.forEach(s => cb(s, 'body'));
    }

    toString() {
        return (this.isPrivate ? 'private ' : '') +
            (this.isFinal ? 'final ' : '') +
            (this.returnType ? this.returnType.toString() + ':' : '') +
            this.name + '(' +
            this.params.map(p => p.toString()).join('') + ') {\n' +
            this.body.map(s => s.toString()).join('') +
            '}\n';
    }

};
