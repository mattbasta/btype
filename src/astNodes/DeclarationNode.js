import BaseStatementNode from './BaseStatementNode';


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
        bitstr.writebits(this.value ? 1 : 0, 1);
        bitstr.writebits(this.type ? 1 : 0, 1);
        if (this.type) this.type.pack(bitstr);
        this.packStr(bitstr, this.name);
        if (this.value) this.value.pack(bitstr);
    }

    traverse(cb) {
        cb(this.type, 'type');
        if (this.value) {
            cb(this.value, 'value');
        }
    }

    toString() {
        var out;
        if (this.type) {
            out = this.type.toString() + ':';
        } else {
            out = 'var ';
        }
        out += this.name;
        if (this.value) {
            out += ' = ';
            out += this.value.toString();
        }
        out += ';';
        return out;
    }
};
