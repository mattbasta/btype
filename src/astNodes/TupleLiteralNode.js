import BaseNode from './BaseNode';


export default class TupleLiteralNode extends BaseNode {
    constructor(elements, start, end) {
        super(start, end);
        this.elements = elements;
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
