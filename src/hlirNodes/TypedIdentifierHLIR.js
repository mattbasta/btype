import BaseHLIR from './BaseHLIR';


export default class TypedIdentifierHLIR extends BaseHLIR {

    constructor(name, type, start, end) {
        super(start, end);
        this.name = name;
        this.type = type;
    }

};
