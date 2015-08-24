import BaseHLIR from './BaseHLIR';


export default class DeclarationHLIR extends BaseHLIR {

    constructor(type, name, value, start, end) {
        super(start, end);
        this.type = type;
        this.name = name;
        this.value = value;

        this.isConst = false;
    }

    setConst(val) {
        this.isConst = val;
    }

};
