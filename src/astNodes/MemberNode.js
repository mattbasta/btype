import BaseExpressionNode from './BaseExpressionNode';
import MemberHLIR from '../hlirNodes/MemberHLIR';
import * as symbols from '../symbols';


export default class MemberNode extends BaseExpressionNode {
    constructor(base, child, start, end) {
        super(start, end);

        this.base = base;
        this.child = child;
    }

    get id() {
        return 17;
    }

    pack(bitstr) {
        super.pack(bitstr);
        this.base.pack(bitstr);
        this.packStr(bitstr, this.child);
    }

    traverse(cb) {
        cb(this.base, 'base');
    }

    toString() {
        return this.base.toString() + '.' + this.child;
    }

    [symbols.FMAKEHLIR](builder) {
        return new MemberHLIR(
            this.base[symbols.FMAKEHLIR](builder),
            this.child,
            this.start,
            this.end
        );
    }

};
