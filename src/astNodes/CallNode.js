import BaseExpressionNode from './BaseExpressionNode';


export default class CallNode extends BaseExpressionNode {
    constructor(callee, params, start, end) {
        super(start, end);
        this.callee = callee;
        this.params = params;
    }

    get id() {
        return 4;
    }

    pack(bitstr) {
        super.pack(bitstr);
        bitstr.writebits(this.params.length, 32);
        this.callee.pack(bitstr);
        this.params.forEach(p => p.pack(bitstr));
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
