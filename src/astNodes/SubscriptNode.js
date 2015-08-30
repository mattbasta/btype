import BaseExpressionNode from './BaseExpressionNode';
import SubscriptHLIR from '../hlirNodes/SubscriptHLIR';
import * as symbols from '../symbols';


export default class SubscriptNode extends BaseExpressionNode {
    constructor(base, childExpr, start, end) {
        super(start, end);

        this.base = base;
        this.childExpr = childExpr;
    }

    get id() {
        return 27;
    }

    pack(bitstr) {
        super.pack(bitstr);
        this.base.pack(bitstr);
        this.childExpr.pack(bitstr);
    }

    traverse(cb) {
        cb(this.base, 'base');
        cb(this.childExpr, 'childExpr');
    }

    toString() {
        return this.base.toString() + '[' + this.childExpr.toString() + ']';
    }

    [symbols.FMAKEHLIR](builder) {
        var baseNode = this.base[symbols.FMAKEHLIR](builder);
        var childExprNode = this.childExpr[symbols.FMAKEHLIR](builder);

        return new SubscriptHLIR(baseNode, childExprNode, this.start, this.end);
    }

};
