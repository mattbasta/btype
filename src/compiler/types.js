var nodes = require('./nodes');
var generatorNodes = require('./generators/nodes');

var Literal = generatorNodes.Literal;
var HeapLookup = generatorNodes.HeapLookup;
var Binop = generatorNodes.Binop;


function Primitive(typeName, backing) {
    this._type = 'primitive';
    this.typeName = typeName;
    this.backing = backing;

    this.getSize = function() {
        switch (this.typeName) {
            case 'int':
            case 'uint':
                return 4;
            case 'byte':
                return 1;
            case 'float64':
                return 8;
        }
    };

    this.toString = function() {
        return typeName;
    };

}
function Array_(contentsType, length) {
    this._type = 'array';
    this.contentsType = contentsType;
    this.length = length;

    this.subscript = function(index) {
        return 4 + index * this.contentType.getSize();
    };
    this.getSize = function() {
        return this.length * this.contentsType.getSize() + 4;
    };

    this.toString = function() {
        return 'array<' + contentsType.toString() + ',' + length + '>';
    };

}
function Slice(contentsType) {
    this._type = 'slice';
    this.contentsType = contentsType;

    // this.subscript = function(index) {
    //     return 4 + index * this.contentType.getSize();
    // };
    // this.getSize = function() {
    //     return this.length * this.contentsType.getSize() + 4;
    // };

    this.toString = function() {
        return 'slice<' + contentsType.toString() + '>';
    };

}
function Struct(name, contentsTypeMap) {
    this.typeName = name;
    this._type = 'struct';
    this.contentsTypeMap = contentsTypeMap;

    this.resolve = function(pointer) {
        return HeapLookup({
            heap: 'ptrheap',
            pointer: base,
            offset: 0
        });
    };

}
function Tuple(contentsTypeArr) {
    this._type = 'tuple';
    this.contentsTypeArr = contentsTypeArr;

    this.resolve = function(pointer) {
        return HeapLookup({
            heap: 'ptrheap',
            pointer: base,
            offset: 0
        });
    };

}
function Func(returnType, args) {
    this._type = 'func';
    this.returnType = returnType;
    this.args = args;
}


exports.Primitive = Primitive;
exports.Array = Array_;
exports.Slice = Slice;
exports.Struct = Struct;
exports.Tuple = Tuple;

exports.Func = Func;


var public_ = exports.publicTypes = {
    'int': new Primitive('int', 'int32'),
    'float': new Primitive('float', 'float64'),
    'bool': new Primitive('bool', 'uint8'),
    'null': new Primitive('null', 'uint32'),
};


var private_ = exports.privateTypes = {
    'byte': new Primitive('byte', 'uint8'),
    'uint': new Primitive('uint', 'uint32')
};

public_.str = new Struct('str', {
    _data: new Slice(private_.byte),
});

exports.resolve = function(typeName, privileged) {
    if (typeName in public_) return public_[typeName];
    if (typeName in private_ && privileged) return private_[typeName];
    return null;
};
