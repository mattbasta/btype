import BaseHLIR from './BaseHLIR';

export default class BaseBlockHLIR extends BaseHLIR {
    settleTypesForArr(ctx, arr) {
        arr.forEach(x => x.settleTypes(ctx));
    }
};
