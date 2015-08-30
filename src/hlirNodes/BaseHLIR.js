export default class BaseHLIR {

    constructor(start, end) {
        this.start = start;
        this.end = end;
    }

    settleTypes() {}

    get TypeError(error) {
        return new TypeError(error + ' (' + this.start + ':' + this.end + ')');
    }

};
