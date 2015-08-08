import BaseNode from './BaseNode';


export default class AssignmentNode extends BaseNode {
    constructor(base, value, start, end) {
        super(start, end);
        this.base = base;
        this.value = value;
    }

    traverse(cb) {
        cb(this.base, 'base');
        cb(this.value, 'value');
    }

    toString() {
        return this.base.toString() + ' = ' + this.value.toString() + ';';
    }
};
