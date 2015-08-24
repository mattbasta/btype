import BaseLoopNode from './BaseLoopNode';
import DoWhileHLIR from '../hlirNodes/DoWhileHLIR';
import * as symbols from '../symbols';


export default class DoWhileNode extends BaseLoopNode {
    constructor(condition, body, start, end) {
        super(body, start, end);
        this.condition = condition;
    }

    get id() {
        return 9;
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
        return 'do {\n' +
            this.body.map(e => e.toString()).join('') +
            '} while (' + this.condition.toString() + ');\n';
    }

    [symbols.FMAKEHLIR](builder) {
        var conditionNode = this.condition[symbols.FMAKEHLIR](builder);
        var node = new DoWhileHLIR(conditionNode, this.start, this.end);
        node.setBody(this[symbols.FMAKEHLIRBLOCK](builder, this.body));

        return node;
    }

};
