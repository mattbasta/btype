import BaseBinopHLIR from './BaseBinopHLIR';
import {publicTypes} from '../compiler/types';
import Struct from '../compiler/types/Struct';


export default class BinopEqualityHLIR extends BaseBinopHLIR {

    constructor(left, operator, right, start, end) {
        super(start, end);
        this.left = left;
        this.operator = operator;
        this.right = right;
    }

    resolveType(ctx) {
        var leftType = this.left.resolveType(ctx);
        var rightType = this.right.resolveType(ctx);

        if (!leftType && !rightType) {
            throw new TypeError('Cannot compare null to null');
        }

        if (!leftType || !rightType) {
            if (!(leftType instanceof Struct || rightType instanceof Struct)) {
                throw this.TypeError(
                    `Cannot compare non-object type ${leftType || rightType} to null`
                );
            }
            return publicTypes.bool;
        }

        if (!leftType.equals(rightType)) {
            throw this.TypeError(
                `Cannot convert ${leftType} to ${rightType} for "${this.operator}"`
            );
        }
        return publicTypes.bool;
    }

};
