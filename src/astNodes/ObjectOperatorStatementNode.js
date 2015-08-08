import BaseNode from './BaseNode';


export default class ObjectOperatorStatementNode extends BaseNode {
    constructor(returnType, left, operator, right, body, start, end) {
        super(start, end);

        this.returnType = returnType;
        this.left = left;
        this.operator = operator;
        this.right = right;
        this.body = body;
    }

    traverse(cb) {
        cb(this.returnType, 'returnType');
        cb(this.right, 'right');
        cb(this.left, 'left');
        this.body.forEach(s => cb(s, 'body'));
    }

    toString() {
        return 'operator (' +
            this.left.toString() + ' ' +
            this.operator + ' ' +
            this.right.toString() + ') ' +
            this.returnType.toString() + ' {\n' +
            this.body.map(s => s.toString()).join('') +
            '}\n';
    }

};
