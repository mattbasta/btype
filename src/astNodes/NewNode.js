import BaseExpressionNode from './BaseExpressionNode';


export default class NewNode extends BaseExpressionNode {
    constructor(type, args, start, end) {
        super(start, end);

        this.type = type;
        this.arguments = args;
    }

    get id() {
        return 18;
    }

    pack(bitstr) {
        super.pack(bitstr);
        bitstr.writebits(this.arguments.length, 32);
        this.type.pack(bitstr);
        this.arguments.forEach(a => a.pack(bitstr));
    }

    traverse(cb) {
        cb(this.type, 'type');
        this.arguments.forEach(a => cb(a, 'arguments'));
    }

    toString() {
        return 'new ' + this.type.toString() + '(' +
            this.arguments.map(a => a.toString()).join(', ') + ')';
    }

};
