import BaseLoopNode from './_loop';


export default class DoWhileNode extends BaseLoopNode {
    constructor(condition, body, start, end) {
        super(body, start, end);
        this.condition = condition;
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
};
