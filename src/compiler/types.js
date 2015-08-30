exports.Array = require('./types/Array');
import Func from './types/Func';
import Module from './types/Module';
exports.Primitive = require('./types/Primitive');
exports.String = require('./types/String');
exports.Struct = require('./types/Struct');
import Tuple from './types/Tuple';


export const publicTypes = {
    'int': new exports.Primitive('int', 'int32'),
    'float': new exports.Primitive('float', 'float64'),
    'sfloat': new exports.Primitive('sfloat', 'float32'),
    'bool': new exports.Primitive('bool', 'uint8'),
    'str': new exports.String(),
};


export const privateTypes = {
    'byte': new exports.Primitive('byte', 'uint8'),
    'uint': new exports.Primitive('uint', 'uint32')
};

export function resolve(typeName, privileged) {
    if (typeName in publicTypes) return publicTypes[typeName];
    if (typeName in privateTypes && privileged) return privateTypes[typeName];
    return null;
};
