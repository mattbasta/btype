import BaseNode from './BaseNode';


export default class TypeMemberNode extends BaseNode {
    constructor(base, child, attributes, start, end) {
        super(start, end);
        this.base = base;
        this.child = child;
        this.attributes = attributes;
    }

    traverse(cb) {
        cb(this.base, 'base');
        this.attributes.forEach(a => cb(a, 'attributes'));
    }

    toString() {
        return this.base.toString() + '.' +
            this.child +
            (this.attributes.length ? '<' + this.attributes.map(a => a.toString()).join('') + '>' : '');
    }
};
