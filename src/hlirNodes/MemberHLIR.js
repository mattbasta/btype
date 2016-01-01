import BaseExpressionHLIR from './BaseExpressionHLIR';
import Struct from '../compiler/types/Struct';
import * as symbols from '../symbols';


export default class MemberHLIR extends BaseExpressionHLIR {

    constructor(base, child, start, end) {
        super(start, end);
        this.base = base;
        this.child = child;
    }

    resolveType(ctx) {
        var baseType = this.base.resolveType(ctx);

        if (baseType instanceof Struct && baseType.privateMembers.has(this.child)) {
            let insideObjectScope = false;
            let tmp = ctx;
            while (tmp) {
                if (tmp[symbols.BASE_PROTOTYPE]) {
                    if (tmp[symbols.BASE_PROTOTYPE].resolveType(ctx).equals(baseType)) {
                        insideObjectScope = true;
                    }
                    break;
                }
                tmp = tmp.parent;
            }

            if (!insideObjectScope) {
                throw this.TypeError(
                    `Accessing private member "${this.child}" from outside object declaration`
                );
            }
        }

        if (baseType.hasMethod && baseType.hasMethod(this.child)) {
            return baseType.getMethodType(this.child, ctx);
        }

        if (!baseType.hasMember(this.child)) {
            throw this.TypeError(`Member not found for type "${baseType}": ${this.child}`);
        }

        return baseType.getMemberType(this.child);
    }

};
