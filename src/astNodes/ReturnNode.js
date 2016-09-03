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
        const scopeReturnType = builder.peekCtx().scope.returnType;
        const returnType = scopeReturnType ? scopeReturnType.resolveType(builder.peekCtx()) : null;

        let valueNode = null;
        if (this.value) {
            if (!returnType) {
                throw this.TypeError('Value returned where void return was expected');
            }
            valueNode = this.value[symbols.FMAKEHLIR](builder, returnType);
            const valueType = valueNode.resolveType(builder.peekCtx());
            if (returnType && !valueType.equals(returnType)) {
                throw this.TypeError('Attempted to return ' + valueType + ' where ' + returnType + ' was expected');
            }
        }

        return new ReturnHLIR(valueNode, this.start, this.end);
    }

};
