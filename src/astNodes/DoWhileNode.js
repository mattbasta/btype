import BaseLoopNode from './BaseLoopNode';


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
};
