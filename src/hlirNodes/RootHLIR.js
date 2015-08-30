import BaseBlockHLIR from './BaseBlockHLIR';
import * as symbols from '../symbols';


export default class RootHLIR extends BaseBlockHLIR {
    constructor(start, end) {
        super(start, end);
        this.body = [];
    }

    setBody(body) {
        this.body = this.body.concat(body);
    }

    settleTypes() {
        var ctx = this[symbols.CONTEXT];
        this.settleTypesForArr(ctx, this.body);
    }

};
