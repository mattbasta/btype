import BaseExpressionNode from './BaseExpressionNode';


const BINOPS = [
    'or',
    'and',
    '==',
    '!=',
    '<',
    '>',
    '<=',
    '>=',
    '|',
    '^',
    '&',
    '<<',
    '>>',
    '+',
    '-',
    '*',
    '/',
    '%',
];


export default class BinopNode extends BaseExpressionNode {
    constructor(left, operator, right, start, end) {
        super(start, end);
        this.left = left;
        this.operator = operator;
        this.right = right;
    }

    get id() {
        return 2;
    }

    pack(bitstr) {
        super.pack(bitstr);
        bitstr.writebits(BINOPS.indexOf(this.operator), 8);
        this.left.pack(bitstr);
        this.right.pack(bitstr);
    }

    traverse(cb) {
        cb(this.left, 'left');
        cb(this.right, 'right');
    }

    toString() {
        return '(' +
            this.left.toString() + ' ' +
            this.operator + ' ' +
            this.right.toString() +
            ')';
    }
};
