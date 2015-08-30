import BaseStatementNode from './BaseStatementNode';
import * as symbols from '../symbols';

export default class BaseBlockNode extends BaseStatementNode {

    packBlock(bitstr, propName) {
        var prop = this[propName]
        if (!prop) {
            bitstr.writebits(0, 1);
            return;
        }
        bitstr.writebits(1, 1);
        bitstr.writebits(prop.length, 32);
        prop.forEach(p => p.pack(bitstr));
    }

    [symbols.FMAKEHLIRBLOCK](builder, arr, expectedType) {
        return arr.map(a => a[symbols.FMAKEHLIR](builder, expectedType))
                  .map(a => Array.isArray(a) ? a : [a])
                  .reduce((a, b) => a.concat(b), []);
    }

};
