import BaseBlockHLIR from './BaseBlockHLIR';
import {publicTypes} from '../compiler/types';


export default class LoopHLIR extends BaseBlockHLIR {

    constructor(condition, consequent, alternate, start, end) {
        super(start, end);
        this.condition = condition;
        this.consequent = consequent;
        this.alternate = alternate;
    }

    settleTypes(ctx) {
        const conditionType = this.condition.resolveType(ctx);
        if (!conditionType.equals(publicTypes.bool)) {
            throw new TypeError('Cannot use ' + conditionType.toString() + ' as condition');
        }
        this.settleTypesForArr(ctx, this.consequent);
        if (this.alternate) {
            this.settleTypesForArr(ctx, this.alternate);
        }
    }

};
