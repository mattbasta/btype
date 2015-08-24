import BaseHLIR from './BaseHLIR';


export default class TypeMemberHLIR extends BaseHLIR {

    constructor(base, child, attributes, start, end) {
        super(start, end);
        this.base = base;
        this.child = child;
        this.attributes = attributes;
    }

};
