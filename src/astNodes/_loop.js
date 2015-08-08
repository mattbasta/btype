import BaseNode from './BaseNode';


export default class BaseLoopNode extends BaseNode {
    constructor(body, start, end) {
        super(start, end);
        this.body = body;
    }

    traverse(cb) {
        this.body.forEach(b => {
            cb(b, 'body');
        });
    }
};
