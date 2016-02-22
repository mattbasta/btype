import BaseBlockHLIR from './BaseBlockHLIR';
import {publicTypes} from '../compiler/types';


export default class CatchHLIR extends BaseBlockHLIR {

    constructor(ident, start, end) {
        super(start, end);
        this.ident = ident;
        this.body = null;
    }

    setBody(body) {
        this.body = body;
    }

    settleTypes(ctx) {
        this.ident.resolveType(ctx);
        this.settleTypesForArr(ctx, this.body);
    }

};
