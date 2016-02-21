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
        return 'import ' + this.base +
            (this.member ? '.' + this.member : '') +
            (this.alias ? ' as ' + this.alias : '') +
            ';\n';
    }


    [symbols.FMAKEHLIR](builder) {
        var node = new ImportHLIR(this.base, this.member, this.alias, this.start, this.end);

        var imp = builder.env.doImport(node, builder.peekCtx());
        var impName = this.base;
        if (this.member) impName = this.member;
        if (this.alias) impName = this.alias;

        builder.peekCtx().addVar(impName, imp);

        return node;
    }

};
