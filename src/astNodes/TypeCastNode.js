import BaseNode from './BaseNode';


export default class TypeCastNode extends BaseNode {
    constructor(base, target, start, end) {
        super(start, end);
        this.base = base;
        this.target = target;
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
