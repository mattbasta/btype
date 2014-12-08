var nodes = require('./nodes');


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

    this.toString = this.flatTypeName = function() {
        return typeName;
    };

    this.equals = function(x) {
        return x instanceof Primitive &&
            this.typeName === x.typeName;
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

    this.flatTypeName = function() {
        return 'array$' + contentsType.flatTypeName() + '$' + length;
    };

    this.equals = function(x) {
        return x instanceof Array_ &&
            this.contentsType.equals(x.contentsType) &&
            this.length === x.length;
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

    this.flatTypeName = function() {
        return 'slice$' + contentsType.flatTypeName();
    };

    this.equals = function(x) {
        return x instanceof Slice && this.contentsType.equals(x.contentsType);
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

    this.equals = function(x) {
        if (!(x instanceof Struct && this.typeName === x.typeName)) return false;
        if (Object.keys(this.contentsTypeMap).length !== Object.keys(x.contentsTypeMap).length) return false;
        for (var key in this.contentsTypeMap) {
            if (!(key in x.contentsTypeMap)) return false;
            if (!this.contentsTypeMap[key].equals(x.contentsTypeMap[key])) return false;
        }
        return true;
    };

    this.toString = this.flatTypeName = function() {
        return this.typeName;
    };

    this.hasMember = function(name) {
        return name in this.contentsTypeMap;
    };

    this.getMemberType = function(name) {
        return this.contentsTypeMap[name];
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

    this.equals = function(x) {
        if (!(x instanceof Tuple)) return false;
        return this.contentsTypeArr.every(function(type, i) {
            return type.equals(x.contentsTypeArr[i]);
        });
    };

    this.flatTypeName = function() {
        return 'tuple$' + this.contentsTypeArr.map(function(type) {
            return type.flatTypeName();
        }).join('$') + '$$';

        /*
        The final two dollar signs are important. Otherwise, nested tuples
        could cause problems:
            A: tuple$foo$bar
            B: tuple$XXX$bar where XXX is type A
        vs.
            A: tuple$foo$bar$bar
            B: tuple$XXX where XXX is type A

        Both would otherwise be

            tuple$tuple$foo$bar$bar

        instead, they become

            tuple$tuple$foo$bar$$bar$$
            tuple$tuple$foo$bar$bar$$$$

        respectively.

        */
    };

}

function Func(returnType, args) {
    this._type = 'func';
    this.returnType = returnType;
    this.args = args;

    this.equals = function(x) {
        if (!(x instanceof Func)) return false;
        if (!(this.returnType ? this.returnType.equals(x.returnType) : !x.returnType)) return false;
        if (this.args.length !== x.args.length) return false;
        return this.args.every(function(arg, i) {
            return arg.equals(x.args[i]);
        });
    };

    this.toString = function() {
        return 'func<' +
            (this.returnType ? this.returnType.toString() : 'null') +
            (this.args.length ? ',' + this.args.map(function(arg) {
                return arg.toString();
            }).join(',') : '') +
            '>';
    };

    this.flatTypeName = function() {
        return 'func$' +
            (this.returnType ? this.returnType.toString() : 'null') +
            (this.args.length ? '$' + this.args.map(function(arg) {
                return arg.toString();
            }).join('$') : '') +
            '$$';
    };
}


exports.Primitive = Primitive;
exports.Array = Array_;
exports.Slice = Slice;
exports.Struct = Struct;
exports.Tuple = Tuple;
exports.Func = Func;

function Module(mod) {
    this._type = 'module';
    this.mod = mod;
    this.memberMapping = mod.exports;

    this.equals = function(x) {
        return false; // Modules do not have type equality.
    };

    this.flatTypeName = this.toString = this.flatTypeName = function() {
        return 'module';
    };

    this.hasMember = function(name) {
        return name in this.memberMapping;
    };

    this.getMemberType = function(name) {
        return mod.typeMap[this.memberMapping[name]];
    };

}

exports.Module = Module;


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
