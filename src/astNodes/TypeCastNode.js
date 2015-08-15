import BaseExpressionNode from './BaseExpressionNode';


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
};
