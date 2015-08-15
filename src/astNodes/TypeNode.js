import BaseNode from './BaseNode';


export default class TypeNode extends BaseNode {
    constructor(name, attributes, start, end) {
        super(start, end);
        this.name = name;
        this.attributes = attributes;
    }

    get id() {
        return 35;
    }

    pack(bitstr) {
        super.pack(bitstr);
        bitstr.writebits(this.attributes.length, 32);
        this.attributes.forEach(a => a.pack(bitstr));
        this.packStr(bitstr, this.name);
    }

    traverse(cb) {
        this.attributes.forEach(a => cb(a, 'attributes'));
    }

    toString() {
        return this.name +
            (this.attributes.length ? '<' + this.attributes.map(a => a.toString()).join('') + '>' : '');
    }
};
