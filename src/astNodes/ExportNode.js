import BaseNode from './BaseNode';


export default class ExportNode extends BaseNode {
    constructor(value, start, end) {
        super(start, end);
        this.value = value;
    }

    traverse() {}

    toString() {
        return 'export ' + this.value.toString() + ';\n';
    }
};
