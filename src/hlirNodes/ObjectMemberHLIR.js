import BaseHLIR from './BaseHLIR';


export default class ObjectMemberHLIR extends BaseHLIR {

    constructor(type, name, value, isPrivate, isFinal, start, end) {
        super(start, end);
        this.type = type;
        this.name = name;
        this.value = value;

        this.isPrivate = isPrivate;
        this.isFinal = isFinal;
    }

    resolveType(ctx) {
        const baseType = this.type.resolveType(ctx);
        if (this.value) {
            const valueType = this.value.resolveType(ctx, baseType);
            if (baseType !== valueType) {
                throw this.TypeError('Member declared as ' + baseType + ' but initialized with ' + valueType);
            }
        }
        return baseType;
    }

};
