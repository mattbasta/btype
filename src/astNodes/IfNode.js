import BaseNode from './BaseNode';


export default class IfNode extends BaseNode {
    constructor(condition, consequent, alternate, start, end) {
        super(start, end);
        this.condition = condition;
        this.consequent = consequent;
        this.alternate = alternate;
    }

    traverse(cb) {
        cb(this.condition, 'condition');
        this.consequent.forEach(s => cb(s, 'consequent'));
        if (this.alternate) {
            this.alternate.forEach(p => cb(p, 'alternate'));
        }
    }

    toString() {
        return 'if (' + this.condition.toString() + ') {\n' +
            this.consequent.map(s => s.toString()).join('') +
            '}' +
            (
                !this.alternate ? '' :
                ' else {\n' +
                    this.alternate.map(s => s.toString()).join('') +
                    '}'
            ) +
            '\n';
    }
};
