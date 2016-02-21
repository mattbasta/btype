import BaseStatementNode from './BaseStatementNode';
import {RaiseHLIR} from '../hlirNodes';
import String_ from '../compiler/types/String';
import * as symbols from '../symbols';


export default class RaiseNode extends BaseStatementNode {
    constructor(expr, start, end) {
        super(start, end);
        this.expr = expr;
    }

    get id() {
        return 40;
    }

    pack(bitstr) {
        super.pack(bitstr);
        this.expr.pack(bitstr);
    }

    traverse(cb) {
        cb(this.expr);
    }

    toString() {
        return `raise ${this.expr};\n`;
    }


    [symbols.FMAKEHLIR](builder) {
        var exprHLIR = this.expr[symbols.FMAKEHLIR](builder);
        var exprHLIRType = exprHLIR.resolveType(builder.peekCtx());
        if (!(exprHLIRType instanceof String_)) {
            throw this.TypeError(`Attempted to raise ${exprHLIRType} but only strings can be raised.`);
        }

        return new RaiseHLIR(exprHLIR, this.start, this.end);
    }

};
