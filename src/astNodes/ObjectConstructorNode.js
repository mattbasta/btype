import BaseNode from './BaseNode';


export default class ObjectConstructorNode extends BaseNode {
    constructor(params, body, isFinal, start, end) {
        super(start, end);

        this.params = params;
        this.body = body;
        this.isFinal = isFinal;
    }

    traverse(cb) {
        this.params.forEach(p => cb(p, 'params'));
        this.body.forEach(s => cb(s, 'body'));
    }

    toString() {
        return 'new(' + this.params.map(p => p.toString()).join(', ') + ') {\n' +
            this.body.map(s => s.toString()).join('') +
            '}\n';
    }

};
