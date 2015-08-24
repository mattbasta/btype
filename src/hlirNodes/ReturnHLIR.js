import BaseHLIR from './BaseHLIR';


export default class ReturnHLIR extends BaseHLIR {

    constructor(value, start, end) {
        super(start, end);
        this.value = value;
    }

};
