import BaseNode from './BaseNode';


export default class SubscriptNode extends BaseNode {
    constructor(base, childExpr, start, end) {
        super(start, end);

        this.base = base;
        this.childExpr = childExpr;
    }

    traverse(cb) {
        cb(this.base, 'base');
        cb(this.childExpr, 'childExpr');
    }

    toString() {
        return this.base.toString() + '[' + this.childExpr.toString() + ']';
    }

};
