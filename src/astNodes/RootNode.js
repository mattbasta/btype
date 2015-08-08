import BaseNode from './BaseNode';


export default class RootNode extends BaseNode {
    constructor(body, start, end) {
        super(start, end);
        this.body = body;
    }

    traverse(cb) {
        this.body.forEach(e => {
            cb(e, 'body');
        });
    }

    toString() {
        return this.body.map(e => e.toString()).join('') + '\n# EOF\n';
    }
};
