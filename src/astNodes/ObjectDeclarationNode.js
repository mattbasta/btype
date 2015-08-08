import BaseNode from './BaseNode';


export default class ObjectDeclarationNode extends BaseNode {
    constructor(
                name,
                objConstructor,
                members,
                methods,
                attributes,
                operators,
                start,
                end
            ) {
        super(start, end);

        this.name = name;
        this.objConstructor = objConstructor;
        this.members = members;
        this.methods = methods;
        this.attributes = attributes;
        this.operators = operators;
    }

    traverse(cb) {
        this.params.forEach(p => cb(p, 'params'));
        this.body.forEach(s => cb(s, 'body'));
    }

    toString() {
        return 'object ' + this.name +
            (this.attributes.length ? '<' + this.attributes.map(a => a.toString()).join(', ') + '>' : '') +
            ' {\n' +
            this.members.map(m => m.toString()).join('') +
            (this.objConstructor ? this.objConstructor.toString() : '') +
            this.methods.map(m => m.toString()).join('') +
            this.operators.map(o => o.toString()).join('') +
            '}\n';
    }

};
