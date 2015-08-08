import BaseNode from './BaseNode';


export default class SwitchTypeNode extends BaseNode {
    constructor(expr, cases, start, end) {
        super(start, end);
        this.expr = expr;
        this.cases = cases;
    }

    traverse(cb) {
        cb(this.expr, 'expr');
        this.cases.forEach(a => cb(a, 'cases'));
    }

    toString() {
        return 'switchtype (' + this.expr.toString() + ') {\n' +
            this.cases.map(c => c.toString()).join('') +
            '}\n';
    }
};
