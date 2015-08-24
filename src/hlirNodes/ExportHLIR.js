import BaseHLIR from './BaseHLIR';


export default class ExportHLIR extends BaseHLIR {

    constructor(value, start, end) {
        super(start, end);
        this.value = value;
    }

};
