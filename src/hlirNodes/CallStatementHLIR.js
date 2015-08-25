import BaseHLIR from './BaseHLIR';


export default class CallStatementHLIR extends BaseHLIR {

    constructor(call, start, end) {
        super(start, end);
        this.call = call;
    }

};
