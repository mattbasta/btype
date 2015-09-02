import BaseExpressionNode from './BaseExpressionNode';
import NegateHLIR from '../hlirNodes/NegateHLIR';
import TwosComplementHLIR from '../hlirNodes/TwosComplementHLIR';
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
        return new (this.operator === OP_NEGATE ? NegateHLIR : TwosComplementHLIR)(
            this.base[symbols.FMAKEHLIR](builder),
            this.start,
            this.end
        );
    }

};
