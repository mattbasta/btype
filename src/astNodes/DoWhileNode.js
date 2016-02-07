import BaseLoopNode from './BaseLoopNode';
import BreakHLIR from '../hlirNodes/BreakHLIR';
import IfHLIR from '../hlirNodes/IfHLIR';
import LiteralHLIR from '../hlirNodes/LiteralHLIR';
import LoopHLIR from '../hlirNodes/LoopHLIR';
import TypeHLIR from '../hlirNodes/TypeHLIR';
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

        var node = new LoopHLIR(
            new LiteralHLIR(new TypeHLIR('bool'), true, 0, 0),
            this.start,
            this.end
        );
        var body = this[symbols.FMAKEHLIRBLOCK](builder, this.body);
        body.push(
            new IfHLIR(conditionNode, [new BreakHLIR(0, 0)], null, 0, 0)
        );
        node.setBody(body);

        return node;
    }

};
