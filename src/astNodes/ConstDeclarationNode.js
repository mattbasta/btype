import BaseStatementNode from './BaseStatementNode';
import DeclarationHLIR from '../hlirNodes/DeclarationHLIR';
import * as symbols from '../symbols';


export default class ConstDeclarationNode extends BaseStatementNode {
    constructor(type, name, value, start, end) {
        super(start, end);
        this.type = type;
        this.name = name;
        this.value = value;
    }

    get id() {
        return 6;
    }

    pack(bitstr) {
        super.pack(bitstr);
        bitstr.writebits(this.value ? 1 : 0, 1);
        this.type.pack(bitstr);
        this.packStr(this.name);
        if (this.value) this.value.pack(bitstr);
    }

    traverse(cb) {
        cb(this.type, 'type');
        if (this.value) {
            cb(this.value, 'value');
        }
    }

    toString() {
        let out;
        if (this.type) {
            out = this.type.toString() + ':';
        } else {
            out = 'const ';
        }
        out += this.name;
        if (this.value) {
            out += ' = ';
            out += this.value.toString();
        }
        out += ';';
        return out;
    }

    [symbols.FMAKEHLIR](builder) {
        const typeNode = this.type ? this.type[symbols.FMAKEHLIR](builder) : null;
        const valueNode = this.value[symbols.FMAKEHLIR](
            builder,
            typeNode && typeNode.resolveType(builder.peekCtx())
        );

        const node = new DeclarationHLIR(typeNode, this.name, valueNode);
        node.setConst(true);

        const ctx = builder.peekCtx();
        const assignedName = ctx.addVar(this.name, (typeNode || valueNode).resolveType(ctx));
        node[symbols.ASSIGNED_NAME] = assignedName;

        return node;
    }

};
