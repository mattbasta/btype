exports.Array = require('./types/Array');
import Func from './types/Func';
import Module from './types/Module';
import Primitive from './types/Primitive';
import String_ from './types/String';
import Struct from './types/Struct';
import Tuple from './types/Tuple';


export const publicTypes = {
    'int': new Primitive('int', 'int32'),
    'float': new Primitive('float', 'float64'),
    'sfloat': new Primitive('sfloat', 'float32'),
    'bool': new Primitive('bool', 'uint8'),
    'str': new String_(),
};


export const privateTypes = {
    'byte': new Primitive('byte', 'uint8'),
    'uint': new Primitive('uint', 'uint32')
};

export function resolve(typeName, privileged) {
    if (typeName in publicTypes) return publicTypes[typeName];
    if (typeName in privateTypes && privileged) return privateTypes[typeName];
    return null;
};
