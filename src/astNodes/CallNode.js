import BaseNode from './BaseNode';


export default class CallNode extends BaseNode {
    constructor(callee, params, start, end) {
        super(start, end);
        this.callee = callee;
        this.params = params;
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
};
