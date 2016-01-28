import Func from '../../types/Func';
import Primitive from '../../types/Primitive';
import * as symbols from '../../../symbols';


/**
 * Converts an internal name to an LLVM IR-friendly name
 * @param  {string} assignedName The assigned name to convert
 * @return {string}
 */
var makeName = exports.makeName = function makeName(assignedName) {
    assignedName = assignedName.replace(/_/g, '.');
    return assignedName.replace(/\$/g, '_');
};

/**
 * Converts a type to the type name used to identify the type in LLVM IR
 * @param  {*} type The type to convert
 * @param  {bool} [funcSig] Set to true for function signatures. This changes
 *                          context object types to i8* to support function
 *                          references properly.
 * @return {string}
 */
var getLLVMType = exports.getLLVMType = function getLLVMType(type, funcSig = false) {
    if (!type) {
        return 'void';
    }

    if (funcSig && type[symbols.IS_CTX_OBJ]) {
        return 'i8*';
    }

    if (type._type === 'string') {
        return '%string*';
    }

    if (type instanceof Primitive) {
        switch (type.typeName) {
            case 'bool': return 'i1';
            case 'int': return 'i32';
            case 'float': return 'double';
            case 'sfloat': return 'float';

            case 'byte': return 'i8';
            case 'uint': return 'i32'; // uint is distinguished by the operators used
        }

        throw new TypeError(`Unknown type name "${type.typeName}"`);
    }

    if (type instanceof Func) {
        // There are two types of functions in LLVM. You have the function
        // pointers and actual function references. We can't use the flat type
        // name directly for function references, since multiple functions of
        // the same type might have different context object types. So we need
        // to create a "clean" function type name.
        // This code only generates the name of the function _reference_ type,
        // so we filter out any context params.
        let filteredFunc = new Func(
            // return type
            type.returnType,
            // The filtered arguments. We conveniently have a flag for ctx objs.
            type.args.filter(arg => !arg[symbols.IS_CTX_OBJ])
        );


        return '%' + makeName(filteredFunc.flatTypeName()) + '*';
    }

    return '%' + makeName(type.flatTypeName()) + '*';
};

/**
 * Returns the byte alignment for a given type
 * @param  {*} type
 * @return {int}
 */
exports.getAlignment = function getAlignment(type) {
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
 * @param  {bool} [noSelf] Whether to include the `self` param
 * @return {string}
 */
exports.getFunctionSignature = function getFunctionSignature(type, noSelf) {
    var out = type.returnType ? getLLVMType(type.returnType) : 'void';
    out += ' (';

    var args = type.args;
    if (noSelf) {
        args = args.slice(1);
    }

    if (args.length) {
        out += args.map(a => getLLVMType(a, true)).join(', ');
    } else {
        out += '';
    }
    out += ')*';
    return out;
};
