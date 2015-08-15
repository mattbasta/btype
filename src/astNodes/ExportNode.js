import BaseStatementNode from './BaseStatementNode';


export default class ExportNode extends BaseStatementNode {
    constructor(value, start, end) {
        super(start, end);
        this.value = value;
    }

    get id() {
        return 10;
    }

    pack(bitstr) {
        super.pack(bitstr);
        this.packStr(bitstr, this.value);
    }

    traverse() {}

    toString() {
        return 'export ' + this.value.toString() + ';\n';
    }
};
