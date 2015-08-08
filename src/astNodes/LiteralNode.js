import BaseNode from './BaseNode';


export default class LiteralNode extends BaseNode {
    constructor(litType, value, start, end) {
        super(start, end);
        this.litType = litType;
        this.value = value;
    }

    traverse() {}

    toString() {
        return this.value === null ? 'null' : this.value.toString();
    }
};
