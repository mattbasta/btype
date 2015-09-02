export default class BaseHLIR {

    constructor(start, end) {
        this.start = start;
        this.end = end;
    }

    settleTypes() {}

    get TypeError() {
        return error => new TypeError(error + ' (' + this.start + ':' + this.end + ')');
    }

};
