import BaseExpressionNode from './BaseExpressionNode';


export default class TypeMemberNode extends BaseExpressionNode {
    constructor(base, child, attributes, start, end) {
        super(start, end);
        this.base = base;
        this.child = child;
        this.attributes = attributes;
    }

    get id() {
        return 34;
    }

    pack(bitstr) {
        super.pack(bitstr);
        this.base.pack(bitstr);
        bitstr.writebits(this.attributes.length, 32);
        this.attributes.forEach(a => a.pack(bitstr));
        this.packStr(bitstr, this.child);
    }

    traverse(cb) {
        cb(this.base, 'base');
        this.attributes.forEach(a => cb(a, 'attributes'));
    }

    toString() {
        return this.base.toString() + '.' +
            this.child +
            (this.attributes.length ? '<' + this.attributes.map(a => a.toString()).join('') + '>' : '');
    }
};
