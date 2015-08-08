import BaseNode from './BaseNode';


export default class ObjectMethodNode extends BaseNode {
    constructor(returnType, name, params, body, isFinal, isPrivate, start, end) {
        super(start, end);

        this.returnType = returnType;
        this.name = name;
        this.params = params;
        this.body = body;
        this.isFinal = isFinal;
        this.isPrivate = isPrivate;
    }

    traverse(cb) {
        if (this.returnType) {
            cb(this.returnType, 'returnType');
        }
        this.params.forEach(p => cb(p, 'params'));
        this.body.forEach(s => cb(s, 'body'));
    }

    toString() {
        return (this.isPrivate ? 'private ' : '') +
            (this.isFinal ? 'final ' : '') +
            (this.returnType ? this.returnType.toString() + ':' : '') +
            this.name + '(' +
            this.params.map(p => p.toString()).join('') + ') {\n' +
            this.body.map(s => s.toString()).join('') +
            '}\n';
    }

};
