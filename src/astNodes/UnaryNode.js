import BaseNode from './BaseNode';


export default class UnaryNode extends BaseNode {
    constructor(operator, base, start, end) {
        super(start, end);
        this.operator = operator;
        this.base = base;
    }

    traverse(cb) {
        cb(this.base, 'base');
    }

    toString() {
        return this.operator + this.base;
    }
};
