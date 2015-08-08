import BaseNode from './BaseNode';


export default class FunctionNode extends BaseNode {
    constructor(returnType, name, params, body, start, end) {
        super(start, end);

        this.returnType = returnType;
        this.name = name;
        this.params = params;
        this.body = body;
    }

    traverse(cb) {
        cb(this.returnType, 'returnType');
        this.params.forEach(p => cb(p, 'params'));
        this.body.forEach(s => cb(s, 'body'));
    }

    toString() {
        return (this.returnType ? this.returnType.toString() + ':' : '') +
            'func' +
            (this.name ? ' ' + this.name : '') +
            '(' + this.params.map(p => p.toString()).join(', ') +
            ') {\n' +
            this.body.map(s => s.toString()).join('') +
            '}\n';
    }

};
