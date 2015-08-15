import BaseStatementNode from './BaseStatementNode';


export default class AssignmentNode extends BaseStatementNode {
    constructor(base, value, start, end) {
        super(start, end);
        this.base = base;
        this.value = value;
    }

    get id() {
        return 1;
    }

    pack(bitstr) {
        super.pack(bitstr);
        this.base.pack(bitstr);
        this.value.pack(bitstr);
    }

    traverse(cb) {
        cb(this.base, 'base');
        cb(this.value, 'value');
    }

    toString() {
        return this.base.toString() + ' = ' + this.value.toString() + ';';
    }
};
