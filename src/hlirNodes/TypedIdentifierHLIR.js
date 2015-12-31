import BaseHLIR from './BaseHLIR';


export default class TypedIdentifierHLIR extends BaseHLIR {

    constructor(name, type, start, end) {
        super(start, end);
        this.name = name;
        this.type = type;
    }

    resolveType(ctx) {
        return this.type.resolveType(ctx);
    }

    toString() {
        return `TypedIdentifierHLIR(${this.name}): ${this.type}`;
    }

};
