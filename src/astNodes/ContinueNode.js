import BaseStatementNode from './BaseStatementNode';


export default class ContinueNode extends BaseStatementNode {
    traverse() {};

    get id() {
        return 7;
    }

    toString() {
        return 'continue;\n';
    }
};
