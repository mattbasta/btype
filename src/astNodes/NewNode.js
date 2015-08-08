import BaseNode from './BaseNode';


export default class NewNode extends BaseNode {
    constructor(type, args, start, end) {
        super(start, end);

        this.type = type;
        this.arguments = args;
    }

    traverse(cb) {
        cb(this.type, 'type');
        this.arguments.forEach(a => cb(a, 'arguments'));
    }

    toString() {
        return 'new ' + this.type.toString() + '(' +
            this.arguments.map(a => a.toString()).join(', ') + ')';
    }

};
