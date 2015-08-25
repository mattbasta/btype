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
        return '(' +
            this.left.toString() + ' ' +
            this.operator + ' ' +
            this.right.toString() +
            ')';
    }

    [symbols.FMAKEHLIR](builder) {
        var node;
        var leftNode = this.left[symbols.FMAKEHLIR](builder);
        var rightNode = this.right[symbols.FMAKEHLIR](builder);

        switch (this.operator) {
            case 'and':
            case 'or':
                node = new BinopLogicalHLIR(leftNode, this.operator, rightNode, this.start, this.end);
                break;
            case '==':
            case '!=':
            case '>=':
            case '<=':
            case '>':
            case '<':
                node = new BinopEqualityHLIR(leftNode, this.operator, rightNode, this.start, this.end);
                break;
            case '|':
            case '^':
            case '&':
            case '<<':
            case '>>':
                node = new BinopBitwiseHLIR(leftNode, this.operator, rightNode, this.start, this.end);
                break;
            case '+':
            case '-':
            case '*':
            case '/':
            case '%':
                node = new BinopArithmeticHLIR(leftNode, this.operator, rightNode, this.start, this.end);
                break;
        }

        return node;
    }

};
