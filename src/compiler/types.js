exports.Array = require('./types/Array');
exports.Func = require('./types/Func');
exports.Module = require('./types/Module');
exports.Primitive = require('./types/Primitive');
exports.String = require('./types/String');
exports.Struct = require('./types/Struct');
exports.Tuple = require('./types/Tuple');


var public_ = exports.publicTypes = {
    'int': new exports.Primitive('int', 'int32'),
    'float': new exports.Primitive('float', 'float64'),
    'sfloat': new exports.Primitive('sfloat', 'float32'),
    'bool': new exports.Primitive('bool', 'uint8'),
};


var private_ = exports.privateTypes = {
    'byte': new exports.Primitive('byte', 'uint8'),
    'uint': new exports.Primitive('uint', 'uint32')
};

public_.str = new exports.String();

exports.resolve = function(typeName, privileged) {
    if (typeName in public_) return public_[typeName];
    if (typeName in private_ && privileged) return private_[typeName];
    return null;
};
