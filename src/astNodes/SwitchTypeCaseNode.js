import BaseNode from './BaseNode';


export default class SwitchTypeCaseNode extends BaseNode {
    constructor(type, body, start, end) {
        super(start, end);
        this.type = type;
        this.body = body;
    }

    traverse(cb) {
        cb(this.type, 'type');
        this.body.forEach(a => cb(a, 'body'));
    }

    toString() {
        return 'case ' + this.type.toString() + ' {\n' +
            this.body.map(s => s.toString()).join('') +
            '}\n';
    }
};
