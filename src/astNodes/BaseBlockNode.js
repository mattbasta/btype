import BaseStatementNode from './BaseStatementNode';

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

};
