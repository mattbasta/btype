import BaseBlockNode from './BaseBlockNode';


export default class BaseLoopNode extends BaseBlockNode {
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
