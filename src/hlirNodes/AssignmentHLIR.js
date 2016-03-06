import BaseHLIR from './BaseHLIR';
import MemberHLIR from './MemberHLIR';
import Struct from '../compiler/types/Struct';
import * as symbols from '../symbols';


export default class AssignmentHLIR extends BaseHLIR {

    constructor(base, value, start, end) {
        super(start, end);
        this.base = base;
        this.value = value;
    }

    settleTypes(ctx) {
        const baseType = this.base.resolveType(ctx);

        if (baseType[symbols.IS_METHOD]) {
            throw this.TypeError(
                'Attempted to assign a value to a class method, which is not allowed.'
            );
        }

        if (this.base instanceof MemberHLIR) {
            this.checkFinality(ctx, baseType);
        }

        const valueType = this.value.resolveType(ctx, baseType);
        if (!baseType.equals(valueType)) {
            throw this.TypeError(
                `Attempted to assign ${valueType} to variable declared as ${baseType}`
            );
        }

    }

    checkFinality(ctx, baseType) {
        const member = this.base;
        const memberBaseType = member.base.resolveType(ctx);

        if (!(memberBaseType instanceof Struct) ||
            !memberBaseType.finalMembers.has(member.child)) {
            return;
        }

        let tmp = ctx;
        while (tmp) {
            // Did we find the constructor in the function stack?
            if (tmp.scope[symbols.ASSIGNED_NAME] === memberBaseType.objConstructor) {
                return;
            }
            tmp = tmp.parent;
        }

        throw this.TypeError(
            `Attempted to set final member "${member.child}" from outside object constructor`
        );

    }

};
