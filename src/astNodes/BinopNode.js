import BaseExpressionNode from './BaseExpressionNode';
import BinopArithmeticHLIR from '../hlirNodes/BinopArithmeticHLIR';
import BinopBitwiseHLIR from '../hlirNodes/BinopBitwiseHLIR';
import BinopEqualityHLIR from '../hlirNodes/BinopEqualityHLIR';
import BinopLogicalHLIR from '../hlirNodes/BinopLogicalHLIR';
import * as symbols from '../symbols';


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
        return `(${this.left} ${this.operator} ${this.right})`;
    }

    [symbols.FMAKEHLIR](builder) {
        const leftNode = this.left[symbols.FMAKEHLIR](builder);
        const rightNode = this.right[symbols.FMAKEHLIR](builder);

        switch (this.operator) {
            case 'and':
            case 'or':
                return new BinopLogicalHLIR(leftNode, this.operator, rightNode, this.start, this.end);
            case '==':
            case '!=':
            case '>=':
            case '<=':
            case '>':
            case '<':
                return new BinopEqualityHLIR(leftNode, this.operator, rightNode, this.start, this.end);
            case '|':
            case '^':
            case '&':
            case '<<':
            case '>>':
                return new BinopBitwiseHLIR(leftNode, this.operator, rightNode, this.start, this.end);
            case '+':
            case '-':
            case '*':
            case '/':
            case '%':
                return new BinopArithmeticHLIR(leftNode, this.operator, rightNode, this.start, this.end);
            default:
                throw new Error(`Unrecognized operator "${this.operator}"`);
        }

    }

};
