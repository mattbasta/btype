import BaseExpressionNode from './BaseExpressionNode';
import BinopArithmeticHLIR from '../hlirNodes/BinopArithmeticHLIR';
import LiteralHLIR from '../hlirNodes/LiteralHLIR';
import NegateHLIR from '../hlirNodes/NegateHLIR';
import * as symbols from '../symbols';


const OP_NEGATE = '!';
const OP_TWOSCOMPLEMENT = '~';
const UNARY_OPS = [
    OP_NEGATE,
    OP_TWOSCOMPLEMENT,
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

    [symbols.FMAKEHLIR](builder) {
        if (this.operator === OP_NEGATE) {
            return new NegateHLIR(
                this.base[symbols.FMAKEHLIR](builder),
                this.start,
                this.end
            );
        }

        return new BinopArithmeticHLIR(
            new BinopArithmeticHLIR(
                this.base[symbols.FMAKEHLIR](builder),
                '+',
                new LiteralHLIR('int', 1, this.start, this.end),
                this.start,
                this.end
            ),
            '*',
            new LiteralHLIR('int', -1, this.start, this.end),
            this.start,
            this.end
        );

    }

};
