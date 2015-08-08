import BaseNode from './BaseNode';


export default class TypedIdentifierNode extends BaseNode {
    constructor(type, name, start, end) {
        super(start, end);
        this.type = type;
        this.name = name;
    }

    traverse(cb) {
        cb(this.type, 'type');
    }

    toString() {
        return this.type.toString() + ':' + this.name;
    }
};
