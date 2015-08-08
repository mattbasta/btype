import BaseNode from './BaseNode';


export default class CallStatementNode extends BaseNode {
    constructor(call, start, end) {
        super(start, end);
        this.call = call;
    }

    traverse(cb) {
        cb(this.call, 'call');
    }

    toString() {
        return this.call.toString();
    }
};
