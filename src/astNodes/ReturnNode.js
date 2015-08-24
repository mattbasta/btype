import BaseStatementNode from './BaseStatementNode';
import ReturnHLIR from '../hlirNodes/ReturnHLIR';
import * as symbols from '../symbols';


export default class ReturnNode extends BaseStatementNode {
    constructor(value, start, end) {
        super(start, end);
        this.value = value;
    }

    get id() {
        return 25;
    }

    pack(bitstr) {
        super.pack(bitstr);
        bitstr.writebits(this.value ? 1 : 0, 1);
        if (this.value) this.value.pack(bitstr);
    }

    traverse(cb) {
        if (this.value) {
            cb(this.value, 'value');
        }
    }

    toString() {
        if (this.value) {
            return 'return ' + this.value.toString() + ';\n';
        } else {
            return 'return;\n';
        }
    }

    [symbols.FMAKEHLIR](builder) {
        var returnType = builder.peekCtx().scope.returnType.resolveType(builder.peekCtx());

        var node = new ReturnHLIR(
            this.value ? this.value[symbols.FMAKEHLIR](builder, returnType) : null,
            this.start,
            this.end
        );
    }

};
