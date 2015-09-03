import BaseBlockNode from './BaseBlockNode';
import OperatorStatementNode from './OperatorStatementNode';
import * as symbols from '../symbols';


export default class ObjectOperatorStatementNode extends BaseBlockNode {
    constructor(returnType, left, operator, right, body, start, end) {
        super(start, end);

        this.returnType = returnType;
        this.left = left;
        this.operator = operator;
        this.right = right;
        this.body = body;
    }

    get id() {
        return 23;
    }

    pack(bitstr) {
        super.pack(bitstr);
        this.returnType.pack(bitstr);
        this.packStr(bitstr, this.operator); // TODO: Make this use a table like BinopNode?
        this.left.pack(bitstr);
        this.right.pack(bitstr);
        this.packBlock(bitstr, 'body');
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

    [symbols.FMAKEHLIR](builder) {
        builder.addOpOverload(this);
    }

    [symbols.FCONSTRUCT](ctx) {
        var out = OperatorStatementNode.prototype[symbols.FCONSTRUCT].call(this, ctx);
        out[symbols.IS_OBJOPSTMT] = true;
        return out;
    }

};
