import BaseExpressionNode from './BaseExpressionNode';


export default class TupleLiteralNode extends BaseExpressionNode {
    constructor(elements, start, end) {
        super(start, end);
        this.elements = elements;
    }

    get id() {
        return 31;
    }

    pack(bitstr) {
        super.pack(bitstr);
        bitstr.writebits(this.elements.length, 32);
        this.elements.forEach(e => e.pack(bitstr));
    }

    traverse(cb) {
        this.elements.forEach(e => cb(e, 'elements'));
    }

    toString() {
        return '[: ' +
            this.elements.map(e => e.toString()).join(', ') +
            ']';
    }
};
