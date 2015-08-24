import BaseHLIR from './BaseHLIR';


export default class AssignmentHLIR extends BaseHLIR {

    constructor(base, value, start, end) {
        super(start, end);
        this.base = base;
        this.value = value;
    }

};
