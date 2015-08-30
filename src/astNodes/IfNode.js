import BaseBlockNode from './BaseBlockNode';
import IfHLIR from '../hlirNodes/IfHLIR';
import * as symbols from '../symbols';


export default class IfNode extends BaseBlockNode {
    constructor(condition, consequent, alternate, start, end) {
        super(start, end);
        this.condition = condition;
        this.consequent = consequent;
        this.alternate = alternate;
    }

    get id() {
        return 14;
    }

    pack(bitstr) {
        super.pack(bitstr);
        this.condition.pack(bitstr);
        this.packBlock(bitstr, 'consequent');
        this.packBlock(bitstr, 'alternate');
    }

    traverse(cb) {
        cb(this.condition, 'condition');
        this.consequent.forEach(s => cb(s, 'consequent'));
        if (this.alternate) {
            this.alternate.forEach(p => cb(p, 'alternate'));
        }
    }

    toString() {
        return 'if (' + this.condition.toString() + ') {\n' +
            this.consequent.map(s => s.toString()).join('') +
            '}' +
            (
                !this.alternate ? '' :
                ' else {\n' +
                    this.alternate.map(s => s.toString()).join('') +
                    '}'
            ) +
            '\n';
    }

    [symbols.FMAKEHLIR](builder) {
        var conditionNode = this.condition[symbols.FMAKEHLIR](builder);
        var consequentBlock = this[symbols.FMAKEHLIRBLOCK](builder, this.consequent);
        var alternateBlock = null;
        if (this.alternate) {
            alternateBlock = this[symbols.FMAKEHLIRBLOCK](builder, this.alternate);
        }

        return new IfHLIR(conditionNode, consequentBlock, alternateBlock);
    }

};
