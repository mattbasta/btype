import BaseExpressionNode from './BaseExpressionNode';
import LiteralHLIR from '../hlirNodes/LiteralHLIR';
import * as symbols from '../symbols';


export default class LiteralNode extends BaseExpressionNode {
    constructor(litType, value, start, end) {
        super(start, end);
        this.litType = litType;
        this.value = value;
    }

    get id() {
        return 16;
    }

    pack(bitstr) {
        super.pack(bitstr);
        this.packStr(bitstr, this.litType);
        switch (this.litType) {
            case 'null':
                break;
            case 'int':
                bitstr.writebits(this.value, 32);
                break;
            case 'float':
                bitstr.writebits(this.value, 64);
                break;
            case 'str':
                this.packStr(bitstr, this.value);
                break;
            case 'sfloat':
                bitstr.writebits(this.value, 32);
                break;
            case 'bool':
                bitstr.writebits(this.value, 1);
                break;
        }
    }

    traverse() {}

    toString() {
        return this.value === null ? 'null' : this.value.toString();
    }

    [symbols.FMAKEHLIR](builder) {
        return new LiteralHLIR(this.litType, this.value, this.start, this.end);
    }

};
