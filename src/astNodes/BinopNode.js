import BaseNode from './BaseNode';


export default class BinopNode extends BaseNode {
    constructor(left, operator, right, start, end) {
        super(start, end);
        this.left = left;
        this.operator = operator;
        this.right = right;
    }

    traverse(cb) {
        cb(this.left, 'left');
        cb(this.right, 'right');
    }

    toString() {
        return '(' +
            this.left.toString() + ' ' +
            this.operator + ' ' +
            this.right.toString() +
            ')';
    }
};
