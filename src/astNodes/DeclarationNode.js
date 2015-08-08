import BaseNode from './BaseNode';


export default class DeclarationNode extends BaseNode {
    constructor(type, name, value, start, end) {
        super(start, end);
        this.type = type;
        this.name = name;
        this.value = value;
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
