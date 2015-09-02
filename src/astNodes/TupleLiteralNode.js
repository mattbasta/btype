import BaseExpressionNode from './BaseExpressionNode';
import TupleLiteralHLIR from '../hlirNodes/TupleLiteralHLIR';
import * as symbols from '../symbols';


export default class TupleLiteralNode extends BaseExpressionNode {
    constructor(elements, start, end) {
        super(start, end);
        this.elements = elements;
    }

    get id() {
        return 31;
    }

    pack(bitstr) {
        super.pack(bitstr);
        bitstr.writebits(this.elements.length, 32);
        this.elements.forEach(e => e.pack(bitstr));
    }

    traverse(cb) {
        this.elements.forEach(e => cb(e, 'elements'));
    }

    toString() {
        return '[: ' +
            this.elements.map(e => e.toString()).join(', ') +
            ']';
    }

    [symbols.FMAKEHLIR](builder, expectedType) {
        var assumedTypes = [];
        if (expectedType) {
            if (expectedType._type !== 'tuple') {
                throw new TypeError('Tuple used where another type was expected: ' + expectedType.toString());
            }
            if (expectedType.contentsTypeArr.length !== this.elements.length) {
                throw new TypeError(
                    'Tuple was used with a different number of elements than expected: ' +
                    this.elements.length + ' != ' +
                    expectedType.contentsTypeArr.length
                );
            }
            assumedTypes = expectedType.contentsTypeArr;
        }
        return new TupleLiteralHLIR(
            this.elements.map((e, i) => e[symbols.FMAKEHLIR](builder, assumedTypes[i])),
            this.start,
            this.end
        );
    }

};
