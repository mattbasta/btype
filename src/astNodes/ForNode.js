import BaseLoopNode from './BaseLoopNode';
import LoopHLIR from '../hlirNodes/LoopHLIR';
import * as symbols from '../symbols';


export default class ForNode extends BaseLoopNode {
    constructor(assignment, condition, iteration, body, start, end) {
        super(body, start, end);
        this.assignment = assignment;
        this.condition = condition;
        this.iteration = iteration;
    }

    get id() {
        return 11;
    }

    pack(bitstr) {
        super.pack(bitstr);
        this.assignment.pack(bitstr);
        this.condition.pack(bitstr);
        bitstr.writebits(this.iteration ? 1 : 0, 1);
        if (this.iteration) this.iteration.pack(bitstr);
        this.packBlock(bitstr, 'body');
    }

    traverse(cb) {
        cb(this.assignment, 'assignment');
        cb(this.condition, 'condition');
        if (this.iteration) {
            cb(this.iteration, 'iteration');
        }
        super.traverse(cb);
    }

    toString() {
        return 'for (' + this.assignment.toString().trim() + ' ' +
            this.condition.toString() + '; ' +
            (this.iteration ? this.iteration : '').toString().trim() + ') {\n' +
            this.body.map(e => e.toString()).join('') +
            '}\n';
    }

    [symbols.FMAKEHLIR](builder) {
        var assignmentNode = this.assignment[symbols.FMAKEHLIR](builder);
        var conditionNode = this.condition[symbols.FMAKEHLIR](builder);

        var node = new LoopHLIR(conditionNode, this.start, this.end);

        var body = this[symbols.FMAKEHLIRBLOCK](builder, this.body);
        if (this.iteration) {
            var iterNode = this.iteration[symbols.FMAKEHLIR](builder);
            if (!Array.isArray(iterNode)) {
                iterNode = [iterNode];
            }
            body = body.concat(iterNode);
        }
        node.setBody(body);

        return [
            assignmentNode,
            node,
        ];
    }

};
