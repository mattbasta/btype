import BaseNode from './BaseNode';


export default class SymbolNode extends BaseNode {
    constructor(name, start, end) {
        super(start, end);
        this.name = name;
    }

    traverse(cb) {}

    toString() {
        return this.name;
    }
};
