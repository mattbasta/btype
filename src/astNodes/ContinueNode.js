import BaseNode from './BaseNode';


export default class ContinueNode extends BaseNode {
    traverse() {};

    toString() {
        return 'continue;\n';
    }
};
