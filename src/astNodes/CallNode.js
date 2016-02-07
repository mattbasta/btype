import BaseExpressionNode from './BaseExpressionNode';
import CallHLIR from '../hlirNodes/CallHLIR';
import Func from '../compiler/types/Func';
import * as symbols from '../symbols';


export default class CallNode extends BaseExpressionNode {
    constructor(callee, params, start, end) {
        super(start, end);
        this.callee = callee;
        this.params = params;
    }

    get id() {
        return 4;
    }

    pack(bitstr) {
        super.pack(bitstr);
        bitstr.writebits(this.params.length, 32);
        this.callee.pack(bitstr);
        this.params.forEach(p => p.pack(bitstr));
    }

    traverse(cb) {
        cb(this.callee, 'callee');
        this.params.forEach(p => {
            cb(p, 'params');
        });
    }

    toString() {
        return this.callee.toString() + '(' +
            this.params.map(p => p.toString()).join(', ') +
            ')';
    }

    [symbols.FMAKEHLIR](builder) {
        var calleeHLIR = this.callee[symbols.FMAKEHLIR](builder);
        var calleeHLIRType = calleeHLIR.resolveType(builder.peekCtx());
        return new CallHLIR(
            calleeHLIR,
            this.params.map((p, i) => {
                return p[symbols.FMAKEHLIR](builder, calleeHLIRType instanceof Func && calleeHLIRType.args[i]);
            }),
            this.start,
            this.end
        );
    }
};
