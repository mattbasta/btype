import BaseStatementNode from './BaseStatementNode';
import {ImportHLIR} from '../hlirNodes';
import * as symbols from '../symbols';


export default class ImportNode extends BaseStatementNode {
    constructor(base, member, alias, start, end) {
        super(start, end);
        this.base = base;
        this.member = member;
        this.alias = alias;
    }

    get id() {
        return 15;
    }

    pack(bitstr) {
        super.pack(bitstr);
        bitstr.writebits(this.member ? 1 : 0, 1);
        bitstr.writebits(this.alias ? 1 : 0, 1);
        this.packStr(bitstr, this.base);
        if (this.member) this.packStr(bitstr, this.member);
        if (this.alias) this.packStr(bitstr, this.alias);
    }

    traverse() {}

    toString() {
        const member = this.member ? `.${this.member}` : '';
        const alias = this.alias ? `.${this.alias}` : '';
        return `import ${this.base}${member}${alias};\n`;
    }


    [symbols.FMAKEHLIR](builder) {
        const node = new ImportHLIR(this.base, this.member, this.alias, this.start, this.end);

        const imp = builder.env.doImport(node, builder.peekCtx());
        const impName = this.alias || this.member || this.base;

        builder.peekCtx().addVar(impName, imp);

        return node;
    }

};
