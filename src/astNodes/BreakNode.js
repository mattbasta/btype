import BaseStatementNode from './BaseStatementNode';


export default class BreakNode extends BaseStatementNode {

    get id() {
        return 3;
    }

    traverse() {};

    toString() {
        return 'break;\n';
    }
};
