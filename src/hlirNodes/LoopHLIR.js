import BaseHLIR from './BaseHLIR';


export default class LoopHLIR extends BaseHLIR {

    constructor(condition, start, end) {
        super(start, end);
        this.condition = condition;
        this.body = null;
    }

    setBody(body) {
        this.body = body;
    }

};
