import BaseStatementNode from './BaseStatementNode';


export default class CallStatementNode extends BaseStatementNode {
    constructor(call, start, end) {
        super(start, end);
        this.call = call;
    }

    get id() {
        return 5;
    }

    pack(bitstr) {
        super.pack(bitstr);
        this.call.pack(bitstr);
    }

    traverse(cb) {
        cb(this.call, 'call');
    }

    toString() {
        return this.call.toString();
    }
};
