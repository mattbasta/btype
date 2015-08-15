import BaseBlockNode from './BaseBlockNode';


export default class SwitchTypeNode extends BaseBlockNode {
    constructor(expr, cases, start, end) {
        super(start, end);
        this.expr = expr;
        this.cases = cases;
    }

    get id() {
        return 29;
    }

    pack(bitstr) {
        super.pack(bitstr);
        this.expr.pack(bitstr);
        this.packBlock(bitstr, 'cases');
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
