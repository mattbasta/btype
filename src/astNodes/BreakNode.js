import BaseStatementNode from './BaseStatementNode';
import BreakHLIR from '../hlirNodes/BreakHLIR';
import * as symbols from '../symbols';


export default class BreakNode extends BaseStatementNode {

    get id() {
        return 3;
    }

    traverse() {};

    toString() {
        return 'break;\n';
    }

    [symbols.FMAKEHLIR]() {
        return new BreakHLIR(this.start, this.end);
    }
};
