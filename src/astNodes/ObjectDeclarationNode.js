import BaseBlockNode from './BaseBlockNode';


export default class ObjectDeclarationNode extends BaseBlockNode {
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
        this.attributes = attributes;
        this.members = members;
        this.objConstructor = objConstructor;
        this.methods = methods;
        this.operators = operators;
    }

    get id() {
        return 20;
    }

    pack(bitstr) {
        super.pack(bitstr);
        this.packStr(bitstr, this.name);
        bitstr.writebits(!!this.objConstructor, 1);
        this.packBlock(bitstr, 'attributes');
        if (this.objConstructor) this.objConstructor.pack(bitstr);
        this.packBlock(bitstr, 'members');
        this.packBlock(bitstr, 'methods');
        this.packBlock(bitstr, 'operators');
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
