import Func from '../../types/Func';
import Primitive from '../../types/Primitive';
import * as symbols from '../../../symbols';


/**
 * Converts an internal name to an LLVM IR-friendly name
 * @param  {string} assignedName The assigned name to convert
 * @return {string}
 */
export function makeName(assignedName) {
    return assignedName.replace(/_/g, '.').replace(/\$/g, '_');
};

/**
 * Converts a type to the type name used to identify the type in LLVM IR for a
 * function parameter.
 * @param  {*} type The type to convert
 * @param  {bool} [funcSig] Set to true for function signatures. This changes
 *                          context object types to i8* to support function
 *                          references properly.
 * @return {string}
 */
export function getLLVMParamType(type, asPtr = true) {
    if (!type) {
        return 'void';
    }

    if (type[symbols.IS_CTX_OBJ] || type[symbols.IS_SELF_PARAM]) {
        return 'i8' + (asPtr ? '*' : '');
    }

    return getLLVMType(type, asPtr);
};

/**
 * Converts a type to the type name used to identify the type in LLVM IR
 * @param  {*} btType The type to convert
 * @return {string}
 */
export function getLLVMType(btType, asPtr = true) {
    if (!btType) {
        return 'void';
    }

    const ptrSuffix = asPtr ? '*' : '';

    if (btType._type === 'string') {
        return `%string${ptrSuffix}`;
    }

    if (btType instanceof Primitive) {
        switch (btType.typeName) {
            case 'bool': return 'i1';
            case 'int': return 'i32';
            case 'float': return 'double';
            case 'sfloat': return 'float';

            case 'byte': return 'i8';
            case 'uint': return 'i32'; // uint is distinguished by the operators used
        }

        throw new TypeError(`Unknown type name "${btType.typeName}"`);
    }

    if (btType instanceof Func) {
        // There are two types of functions in LLVM. You have the function
        // pointers and actual function references. We can't use the flat type
        // name directly for function references, since multiple functions of
        // the same type might have different context object types. So we need
        // to create a "clean" function type name.
        // This code only generates the name of the function _reference_ type,
        // so we filter out any context params.
        const filteredFunc = new Func(
            // return type
            btType.returnType,
            // The filtered arguments. We conveniently have a flag for ctx objs.
            btType.args.filter(arg => !arg[symbols.IS_CTX_OBJ] && !arg[symbols.IS_SELF_PARAM])
        );


        return '%' + makeName(filteredFunc.flatTypeName()) + ptrSuffix;
    }

    return '%' + makeName(btType.flatTypeName()) + ptrSuffix;
};

/**
 * Returns the byte alignment for a given type
 * @param  {*} type
 * @return {int}
 */
export function getAlignment(type) {
    if (type._type === 'primitive') {
        return type.getSize();
    }
    if (type._type === 'func') {
        return 8;
    }
    return 8;
};

/**
 * Returns the function signature of a function with a provided type
 * @param  {*} type The function type
 * @return {string}
 */
export function getFunctionSignature(type) {
    let out = type.returnType ? getLLVMType(type.returnType) : 'void';
    out += ' (';

    if (type.args.length) {
        out += type.args.map(x => getLLVMParamType(x)).join(', ');
    }
    out += ')';
    return out;
};
