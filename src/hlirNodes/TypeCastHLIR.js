import BaseExpressionHLIR from './BaseExpressionHLIR';


const safeCastMap = new Map([
    ['bool', new Set(['byte', 'int', 'uint'])],
    ['byte', new Set(['int', 'bool', 'float', 'sfloat', 'uint'])],
    ['float', new Set(['int', 'byte', 'bool', 'sfloat'])],
    ['sfloat', new Set(['float'])],
    ['int', new Set(['float', 'sfloat', 'bool', 'byte', 'uint'])],
    ['uint', new Set(['float', 'sfloat', 'int', 'byte'])],
]);


export default class TypeCastHLIR extends BaseExpressionHLIR {

    constructor(base, target, start, end) {
        super(start, end);
        this.base = base;
        this.target = target;
    }

    resolveType(ctx, expectedType) {
        var baseType = this.base.resolveType(ctx);
        var targetType = this.target.resolveType(ctx);
        if (expectedType && !expectedType.equals(targetType)) {
            throw this.TypeError(`${baseType} was found where ${expectedType} was expected`);
        }

        if (baseType.equals(targetType)) {
            return baseType;
        }

        if (baseType._type !== 'primitive') {
            throw this.TypeError(`Cannot typecast non-primitive "${baseType}" to "${targetType}"`);
        }

        if (targetType._type !== 'primitive') {
            throw this.TypeError(`Cannot typecast "${baseType}" to non-primitive "${targetType}"`);
        }

        if (!safeCastMap.has(baseType.typeName) ||
            !safeCastMap.get(baseType.typeName).has(targetType.typeName)) {
            throw this.TypeError(`Cannot safely typecast "${baseType}" to "${targetType}"`);
        }

        return targetType;
    }

};
