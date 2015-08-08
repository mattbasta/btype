import BaseLoopNode from './_loop';


export default class WhileNode extends BaseLoopNode {
    constructor(condition, body, start, end) {
        super(body, start, end);
        this.condition = condition;
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
};
