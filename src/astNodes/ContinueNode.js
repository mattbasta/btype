import BaseStatementNode from './BaseStatementNode';
import ContinueHLIR from '../hlirNodes/ContinueHLIR';
import * as symbols from '../symbols';


export default class ContinueNode extends BaseStatementNode {
    traverse() {};

    get id() {
        return 7;
    }

    toString() {
        return 'continue;\n';
    }

    [symbols.FMAKEHLIR]() {
        return new ContinueHLIR(this.start, this.end);
    }
};
