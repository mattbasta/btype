import BaseExpressionNode from './BaseExpressionNode';


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

};
