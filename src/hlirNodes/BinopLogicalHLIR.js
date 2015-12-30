import BaseBinopHLIR from './BaseBinopHLIR';
import {publicTypes} from '../compiler/types';


export default class BinopLogicalHLIR extends BaseBinopHLIR {

    constructor(left, operator, right, start, end) {
        super(start, end);
        this.left = left;
        this.operator = operator;
        this.right = right;
    }

    resolveType(ctx) {
        var leftType = this.left.resolveType(ctx);
        if (!leftType.equals(publicTypes.bool)) {
            throw new TypeError('Cannot use "' + this.operator + '" with ' + leftType);
        }
        var rightType = this.right.resolveType(ctx);
        if (!rightType.equals(publicTypes.bool)) {
            throw new TypeError('Cannot use "' + this.operator + '" with ' + rightType);
        }
        return publicTypes.bool;
    }

};
