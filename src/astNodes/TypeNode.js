import BaseNode from './BaseNode';


export default class TypeNode extends BaseNode {
    constructor(name, attributes, start, end) {
        super(start, end);
        this.name = name;
        this.attributes = attributes;
    }

    traverse(cb) {
        this.attributes.forEach(a => cb(a, 'attributes'));
    }

    toString() {
        return this.name +
            (this.attributes.length ? '<' + this.attributes.map(a => a.toString()).join('') + '>' : '');
    }
};
