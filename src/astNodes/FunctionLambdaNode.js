import BaseExpressionNode from './BaseExpressionNode';


export default class FunctionLambdaNode extends BaseExpressionNode {
    constructor(params, body, start, end) {
        super(start, end);
        this.params = params;
        this.body = body;
    }

    get id() {
        return 12;
    }

    pack(bitstr) {
        super.pack(bitstr);
        bitstr.writebits(this.params.length, 32);
        this.body.pack(bitstr);
    }

    traverse(cb) {
        this.params.forEach(p => cb(p, 'params'));
        cb(this.body, 'body');
    }

    toString() {
        return '(' + this.params.map(p => p.toString()).join(', ') + '): ' +
            this.body.toString();
    }
};
