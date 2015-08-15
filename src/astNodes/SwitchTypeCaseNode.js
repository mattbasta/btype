import BaseBlockNode from './BaseBlockNode';


export default class SwitchTypeCaseNode extends BaseBlockNode {
    constructor(type, body, start, end) {
        super(start, end);
        this.type = type;
        this.body = body;
    }

    get id() {
        return 28;
    }

    pack(bitstr) {
        super.pack(bitstr);
        this.type.pack(bitstr);
        this.packBlock(bitstr, 'body');
    }

    traverse(cb) {
        cb(this.type, 'type');
        this.body.forEach(a => cb(a, 'body'));
    }

    toString() {
        return 'case ' + this.type.toString() + ' {\n' +
            this.body.map(s => s.toString()).join('') +
            '}\n';
    }
};
