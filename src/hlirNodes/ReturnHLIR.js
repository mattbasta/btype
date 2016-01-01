import BaseHLIR from './BaseHLIR';
import RootHLIR from './RootHLIR';


export default class ReturnHLIR extends BaseHLIR {

    constructor(value, start, end) {
        super(start, end);
        this.value = value;
    }

    settleTypes(ctx) {
        if (ctx.scope instanceof RootHLIR) {
            throw this.TypeError('Return statements must be within functions');
        }

        if (this.value) {
            this.value.resolveType(ctx);
        }
    }

};
