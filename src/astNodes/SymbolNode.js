import BaseExpressionNode from './BaseExpressionNode';


export default class SymbolNode extends BaseExpressionNode {
    constructor(name, start, end) {
        super(start, end);
        this.name = name;
    }

    get id() {
        return 30;
    }

    pack(bitstr) {
        super.pack(bitstr);
        this.packStr(bitstr, this.name);
    }

    traverse(cb) {}

    toString() {
        return this.name;
    }
};
