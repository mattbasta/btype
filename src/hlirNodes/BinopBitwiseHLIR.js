import BaseBinopHLIR from './BaseBinopHLIR';
import {publicTypes} from '../compiler/types';


export default class BinopBitwiseHLIR extends BaseBinopHLIR {

    constructor(left, operator, right, start, end) {
        super(start, end);
        this.left = left;
        this.operator = operator;
        this.right = right;
    }

    resolveType(ctx) {
        const leftType = this.left.resolveType(ctx);
        const rightType = this.right.resolveType(ctx);
        if (!leftType.equals(rightType)) {
            throw new TypeError('Cannot convert ' + leftType.toString() + ' to ' + rightType.toString() + ' for "' + this.operator + '"');
        }
        return publicTypes.int;
    }

};
