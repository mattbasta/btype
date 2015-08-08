import BaseNode from './BaseNode';


export default class FunctionLambdaNode extends BaseNode {
    constructor(params, body, start, end) {
        super(start, end);
        this.params = params;
        this.body = body;
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
