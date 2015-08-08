import BaseLoopNode from './_loop';


export default class ForNode extends BaseLoopNode {
    constructor(assignment, condition, iteration, body, start, end) {
        super(body, start, end);
        this.assignment = assignment;
        this.condition = condition;
        this.iteration = iteration;
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
