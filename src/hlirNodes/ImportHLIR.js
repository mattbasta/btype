import BaseHLIR from './BaseHLIR';


export default class ImportHLIR extends BaseHLIR {

    constructor(base, member, alias, start, end) {
        super(start, end);
        this.base = base;
        this.member = member;
        this.alias = alias;
    }

    settleTypes() {}

};
