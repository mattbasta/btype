import BaseBlockHLIR from './BaseBlockHLIR';
import {publicTypes} from '../compiler/types';


export default class LoopHLIR extends BaseBlockHLIR {

    constructor(condition, start, end) {
        super(start, end);
        this.condition = condition;
        this.body = null;
    }

    setBody(body) {
        this.body = body;
    }

    settleTypes(ctx) {
        const conditionType = this.condition.resolveType(ctx);
        if (!conditionType.equals(publicTypes.bool)) {
            throw new TypeError('Cannot use ' + conditionType.toString() + ' as loop condition');
        }
        this.settleTypesForArr(ctx, this.body);
    }

};
