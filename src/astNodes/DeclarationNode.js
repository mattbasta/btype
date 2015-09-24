import BaseStatementNode from './BaseStatementNode';
import DeclarationHLIR from '../hlirNodes/DeclarationHLIR';
import * as symbols from '../symbols';


export default class DeclarationNode extends BaseStatementNode {
    constructor(type, name, value, start, end) {
        super(start, end);
        this.type = type;
        this.name = name;
        this.value = value;
    }

    get id() {
        return 8;
    }

    pack(bitstr) {
        super.pack(bitstr);
        bitstr.writebits(this.type ? 1 : 0, 1);
        if (this.type) this.type.pack(bitstr);
        this.packStr(bitstr, this.name);
        this.value.pack(bitstr);
    }

    traverse(cb) {
        cb(this.type, 'type');
        cb(this.value, 'value');
    }

    toString() {
        var out;
        if (this.type) {
            out = this.type.toString() + ':';
        } else {
            out = 'var ';
        }
        out += this.name;
        out += ' = ';
        out += this.value.toString();
        out += ';';
        return out;
    }

    [symbols.FMAKEHLIR](builder) {
        var typeNode = this.type ? this.type[symbols.FMAKEHLIR](builder) : null;
        var valueNode = this.value[symbols.FMAKEHLIR](
            builder,
            typeNode ? typeNode.resolveType(builder.peekCtx()) : null
        );

        var node = new DeclarationHLIR(typeNode, this.name, valueNode);

        var ctx = builder.peekCtx();
        var assignedName = ctx.addVar(this.name, (typeNode || valueNode).resolveType(ctx));
        node[symbols.ASSIGNED_NAME] = assignedName;

        return node;
    }

};
