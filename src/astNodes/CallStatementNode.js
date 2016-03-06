import BaseStatementNode from './BaseStatementNode';
import CallStatementHLIR from '../hlirNodes/CallStatementHLIR';
import * as symbols from '../symbols';


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

    [symbols.FMAKEHLIR](builder) {
        const callNode = this.call[symbols.FMAKEHLIR](builder);
        return new CallStatementHLIR(callNode, this.start, this.end);
    }

};
