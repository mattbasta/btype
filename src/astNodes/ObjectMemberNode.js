import BaseBlockNode from './BaseBlockNode';
import ObjectMemberHLIR from '../hlirNodes/ObjectMemberHLIR';
import * as symbols from '../symbols';


export default class ObjectMemberNode extends BaseBlockNode {
    constructor(type, name, value, isFinal, isPrivate, start, end) {
        super(start, end);

        this.isPrivate = isPrivate;
        this.isFinal = isFinal;
        this.type = type;
        this.name = name;
        this.value = value;
    }

    get id() {
        return 21;
    }

    pack(bitstr) {
        super.pack(bitstr);
        bitstr.writebits(this.value ? 1 : 0, 1);
        bitstr.writebits(this.isPrivate, 1);
        bitstr.writebits(this.isFinal, 1);
        this.type.pack(bitstr);
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
        return (this.isPrivate ? 'private ' : '') +
            (this.isFinal ? 'final ' : '') +
            this.type.toString() + ':' +
            this.name +
            (this.value ? ' = ' + this.value.toString() : '') +
            ';\n';
    }

    [symbols.FMAKEHLIR](builder) {
        return new ObjectMemberHLIR(
            this.type[symbols.FMAKEHLIR](builder),
            this.name,
            this.value ? this.value[symbols.FMAKEHLIR](builder) : null,
            this.isPrivate,
            this.isFinal,
            this.start,
            this.end
        );
    }

};
