import BaseHLIR from './BaseHLIR';


export default class SymbolHLIR extends BaseHLIR {

    constructor(name, start, end) {
        super(start, end);
        this.name = name;
    }

};
