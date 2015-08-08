import BaseNode from './BaseNode';


export default class HLIRAssignmentNode extends BaseNode {
    constructor(base, value, start, end) {
        this.base = base;
        this.value = value;
        super(start, end);
    }

    traverse(cb) {
        cb(this.base);
        cb(this.value);
    };

    toString() {
        return this.base.toString() + ' = ' + this.value.toString() + ';';
    }
};
