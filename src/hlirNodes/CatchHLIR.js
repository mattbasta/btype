import BaseBlockHLIR from './BaseBlockHLIR';
import {publicTypes} from '../compiler/types';
import * as symbols from '../symbols';


export default class CatchHLIR extends BaseBlockHLIR {

    constructor(start, end) {
        super(start, end);
        this.errorIdent = null;
        this.body = null;
    }

    setErrorIdent(errorIdent) {
        this.errorIdent = errorIdent;
    }

    setBody(body) {
        this.body = body;
    }

    settleTypes(ctx) {
        this.settleTypesForArr(this[symbols.CONTEXT], this.body);
    }

};
