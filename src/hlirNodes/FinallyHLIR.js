import BaseBlockHLIR from './BaseBlockHLIR';
import {publicTypes} from '../compiler/types';


export default class FinallyHLIR extends BaseBlockHLIR {

    constructor(body, start, end) {
        super(start, end);
        this.body = body;
    }

    settleTypes(ctx) {
        this.settleTypesForArr(ctx, this.body);
    }

};
