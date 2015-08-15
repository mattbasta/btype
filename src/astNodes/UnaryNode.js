import BaseExpressionNode from './BaseExpressionNode';


const UNARY_OPS = [
    '!',
    '~',
];

export default class UnaryNode extends BaseExpressionNode {
    constructor(operator, base, start, end) {
        super(start, end);
        this.operator = operator;
        this.base = base;
    }

    get id() {
        return 36;
    }

    pack(bitstr) {
        super.pack(bitstr);
        bitstr.writebits(UNARY_OPS.indexOf(this.operator), 32);
        this.base.pack(bitstr);
    }

    traverse(cb) {
        cb(this.base, 'base');
    }

    toString() {
        return this.operator + this.base;
    }
};
