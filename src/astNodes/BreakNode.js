import BaseNode from './BaseNode';


export default class BreakNode extends BaseNode {
    traverse() {};

    toString() {
        return 'break;\n';
    }
};
