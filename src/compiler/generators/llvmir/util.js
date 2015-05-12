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
 * @return {string}
 */
var getLLVMType = exports.getLLVMType = function getLLVMType(type) {
    if (!type) {
        return 'void';
    }

    if (type._type === 'string') {
        return '%string*';
    }

    if (type._type === 'primitive') {
        switch (type.typeName) {
            case 'bool': return 'i1';
            case 'int': return 'i32';
            case 'float': return 'double';
            case 'sfloat': return 'float';

            case 'byte': return 'i8';
            case 'uint': return 'i32'; // uint is distinguished by the operators used
        }

        throw new TypeError('Unknown type name "' + type.typeName + '"');
    }

    if (type._type === 'func') {
        return '%' + makeName(type.flatTypeName()) + '*';
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
        out += args.map(getLLVMType).join(', ');
    } else {
        out += '...';
    }
    out += ')*';
    return out;
};
