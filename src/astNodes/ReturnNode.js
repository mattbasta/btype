import BaseNode from './BaseNode';


export default class ReturnNode extends BaseNode {
    constructor(value, start, end) {
        super(start, end);
        this.value = value;
    }

    traverse(cb) {
        if (this.value) {
            cb(this.value, 'value');
        }
    }

    toString() {
        if (this.value) {
            return 'return ' + this.value.toString() + ';\n';
        } else {
            return 'return;\n';
        }
    }
};
