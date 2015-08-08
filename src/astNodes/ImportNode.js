import BaseNode from './BaseNode';


export default class ImportNode extends BaseNode {
    constructor(base, member, alias, start, end) {
        super(start, end);
        this.base = base;
        this.member = member;
        this.alias = alias;
    }

    traverse() {}

    toString() {
        return 'import ' + this.base +
            (this.member ? '.' + this.member : '') +
            (this.alias ? ' as ' + this.alias : '') +
            ';\n';
    }
};
