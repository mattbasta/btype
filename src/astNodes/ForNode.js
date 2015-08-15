import BaseLoopNode from './BaseLoopNode';


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
};
