import BaseExpressionNode from './BaseExpressionNode';
import TypeCastHLIR from '../hlirNodes/TypeCastHLIR';
import * as symbols from '../symbols';


export default class TypeCastNode extends BaseExpressionNode {
    constructor(base, target, start, end) {
        super(start, end);
        this.base = base;
        this.target = target;
    }

    get id() {
        return 32;
    }

    pack(bitstr) {
        super.pack(bitstr);
        this.base.pack(bitstr);
        this.target.pack(bitstr);
    }

    traverse(cb) {
        cb(this.base, 'base');
        cb(this.target, 'target');
    }

    toString() {
        return '(' +
            this.base.toString() + ' as ' +
            this.target.toString() +
            ')';
    }

    [symbols.FMAKEHLIR](builder) {
        return new TypeCastHLIR(
            this.base[symbols.FMAKEHLIR](builder),
            this.target[symbols.FMAKEHLIR](builder),
            this.start,
            this.end
        )
    }

};
