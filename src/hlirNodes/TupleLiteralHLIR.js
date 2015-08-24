import BaseHLIR from './BaseHLIR';


export default class TupleLiteralHLIR extends BaseHLIR {

    constructor(elements, start, end) {
        super(start, end);
        this.elements = elements;
    }

};
