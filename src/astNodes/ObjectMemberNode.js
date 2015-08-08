import BaseNode from './BaseNode';


export default class ObjectMemberNode extends BaseNode {
    constructor(type, name, value, isFinal, isPrivate, start, end) {
        super(start, end);

        this.type = type;
        this.name = name;
        this.value = value;
        this.isFinal = isFinal;
        this.isPrivate = isPrivate;
    }

    traverse(cb) {
        cb(this.type, 'type');
        if (this.value) {
            cb(this.value, 'value');
        }
    }

    toString() {
        return (this.isPrivate ? 'private ' : '') +
            (this.isFinal ? 'final ' : '') +
            this.type.toString() + ':' +
            this.name +
            (this.value ? ' = ' + this.value.toString() : '') +
            ';\n';
    }

};
