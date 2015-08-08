import BaseNode from './BaseNode';


export default class MemberNode extends BaseNode {
    constructor(base, child, start, end) {
        super(start, end);

        this.base = base;
        this.child = child;
    }

    traverse(cb) {
        cb(this.base, 'base');
    }

    toString() {
        return this.base.toString() + '.' + this.child;
    }

};
