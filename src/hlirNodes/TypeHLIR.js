import BaseHLIR from './BaseHLIR';


export default class TypeHLIR extends BaseHLIR {

    constructor(name, attributes, start, end) {
        super(start, end);
        this.name = name;
        this.attributes = attributes;
    }

};
