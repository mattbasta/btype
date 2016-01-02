import BaseHLIR from './BaseHLIR';
import * as symbols from '../symbols';


export default class DeclarationHLIR extends BaseHLIR {

    constructor(type, name, value, start, end) {
        super(start, end);
        this.type = type;
        this.name = name;
        this.value = value;

        this.isConst = false;
    }

    setConst(val) {
        this.isConst = val;
    }

    settleTypes(ctx) {
        if (this.type) {
            var baseType = this.type.resolveType(ctx);
            var valueType = this.value.resolveType(ctx, baseType);
            if (!baseType.equals(valueType)) {
                throw this.TypeError(
                    `Cannot assign type ${valueType} to variable of type ${baseType}`
                );
            }
        } else {
            this.value.resolveType(ctx);
        }
    }

    resolveType(ctx) {
        if (this.type) {
            return this.type.resolveType(ctx);
        } else {
            return this.value.resolveType(ctx);
        }
    }

    asString() {
        return `DeclarationHLIR(${this.name}:${this[symbols.ASSIGNED_NAME]})`;
    }

};
