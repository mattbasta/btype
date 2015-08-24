import BaseHLIR from './BaseHLIR';


export default class TypeCastHLIR extends BaseHLIR {

    constructor(base, target, start, end) {
        super(start, end);
        this.base = base;
        this.target = target;
    }

};
