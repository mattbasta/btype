import BaseNode from './BaseNode';
import TypedIdentifierHLIR from '../hlirNodes/TypedIdentifierHLIR';
import * as symbols from '../symbols';


export default class TypedIdentifierNode extends BaseNode {
    constructor(type, name, start, end) {
        super(start, end);
        this.type = type;
        this.name = name;
    }

    get id() {
        return 33;
    }

    pack(bitstr) {
        super.pack(bitstr);
        this.type.pack(bitstr);
        this.packStr(bitstr, this.name);
    }

    traverse(cb) {
        cb(this.type, 'type');
    }

    toString() {
        return this.type.toString() + ':' + this.name;
    }

    [symbols.FMAKEHLIR](builder) {
        return new TypedIdentifierHLIR(
            this.name,
            this.type[symbols.FMAKEHLIR](builder),
            this.start,
            this.end
        )
    }
};
