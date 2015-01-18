var makeName = exports.makeName = function makeName(assignedName) {
    assignedName = assignedName.replace(/_/g, '__');
    return assignedName.replace(/$/g, '$d');
};

exports.getLLVMType = function getLLVMType(type) {
    if (type._type === 'primitive') {
        switch (type.typeName) {
            case 'bool': return 'i1';
            case 'int': return 'i32';
            case 'float': return 'double';

            case 'byte': return 'i8';
            case 'uint': return 'i32'; // uint is distinguished by the operators used
        }

        throw new TypeError('Unknown type name "' + type.typeName + '"');
    }

    return '%' + makeName(type.flatTypeName()) + ' *';
};
