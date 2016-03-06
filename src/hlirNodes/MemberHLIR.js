import BaseExpressionHLIR from './BaseExpressionHLIR';
import Struct from '../compiler/types/Struct';
import * as symbols from '../symbols';


const TYPE_CACHE = Symbol();

export default class MemberHLIR extends BaseExpressionHLIR {

    constructor(base, child, start, end) {
        super(start, end);
        this.base = base;
        this.child = child;

        this.checkedVisibility = false;
    }

    resolveType(ctx) {
        if (this[TYPE_CACHE]) {
            return this[TYPE_CACHE];
        }
        const baseType = this.base.resolveType(ctx);

        if (baseType instanceof Struct && baseType.privateMembers.has(this.child)) {
            this.checkVisibility(ctx, baseType);
        }

        if (baseType.hasMethod && baseType.hasMethod(this.child)) {
            return baseType.getMethodType(this.child, ctx);
        }

        if (!baseType.hasMember(this.child)) {
            throw this.TypeError(`Member not found for type "${baseType}": ${this.child}`);
        }

        return this[TYPE_CACHE] = baseType.getMemberType(this.child);
    }

    forceType(type) {
        this[TYPE_CACHE] = type;
    }

    checkVisibility(ctx, baseType) {
        if (this.checkedVisibility) {
            return;
        }
        let insideObjectScope = false;
        let tmp = ctx;
        while (tmp) {
            if (tmp[symbols.BASE_PROTOTYPE]) {
                if (tmp[symbols.BASE_PROTOTYPE][symbols.ASSIGNED_NAME] === baseType[symbols.ASSIGNED_NAME]) {
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

        this.checkedVisibility = true;
    }

    asString() {
        return `${super.asString()} for ${this.child}`;
    }

};
