import BaseLoopNode from './BaseLoopNode';
import LoopHLIR from '../hlirNodes/LoopHLIR';
import * as symbols from '../symbols';


export default class WhileNode extends BaseLoopNode {
    constructor(condition, body, start, end) {
        super(body, start, end);
        this.condition = condition;
    }

    get id() {
        return 37;
    }

    pack(bitstr) {
        super.pack(bitstr);
        this.condition.pack(bitstr);
        this.packBlock(bitstr, 'body');
    }

    traverse(cb) {
        cb(this.condition, 'condition');
        super.traverse(cb);
    }

    toString() {
        return 'while (' + this.condition.toString() + ') {\n' +
            this.body.map(e => e.toString()).join('') +
            '}\n';
    }

    [symbols.FMAKEHLIR](builder) {
        const conditionNode = this.condition[symbols.FMAKEHLIR](builder);
        const node = new LoopHLIR(conditionNode, this.start, this.end);
        node.setBody(this[symbols.FMAKEHLIRBLOCK](builder, this.body));

        return node;
    }

};
