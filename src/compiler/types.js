var nodes = require('./nodes');


function Primitive(typeName, backing) {
    this._type = 'primitive';
    this.typeName = typeName;
    this.backing = backing;

    this.getSize = function() {
        switch (this.typeName) {
            case 'int':
            case 'uint':
            case 'sfloat':
                return 4;
            case 'byte':
            case 'bool':
                return 1;
            case 'float':
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

    this.isSubscriptable = function() {
        return false;
    };

}
function Array_(contentsType, length) {
    this._type = 'array';
    this.contentsType = contentsType;
    this.length = length;

    this.subscript = function(index) {
        // We have an offset of 8 because primitives that take up eight bytes
        // need to be aligned to a multiple of 8 on the heap.
        return 8 + index * this.contentType.getSize();
    };
    this.getSize = function() {
        return null; // Must be special-cased.
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

    this.isSubscriptable = function() {
        return true;
    };

    this.getSubscriptType = function(index) {
        return this.contentsType;
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

    this.isSubscriptable = function() {
        return true;
    };

    this.getSubscriptType = function(index) {
        return this.contentsType;
    };

}
function Struct(name, contentsTypeMap) {
    this._type = 'struct';
    this.typeName = name;
    this.contentsTypeMap = contentsTypeMap;

    this.objConstructor = null;
    this.methods = {} // Mapping of given names to assigned names

    function memberSize(name) {
        var type = contentsTypeMap[name];
        if (type._type === 'primitive') return type.getSize();
        return 4; // pointer size
    }

    function getLayout() {
        var keys = Object.keys(contentsTypeMap);
        keys.sort(function(a, b) {
            return memberSize(a) < memberSize(b);
        });
        return keys;
    }

    var cachedLayout;
    this.getLayout = function() {
        if (cachedLayout) return cachedLayout;
        var layout = getLayout();
        var offsets = {};
        var i = 0;
        layout.forEach(function(key) {
            var size = memberSize(key);
            offsets[key] = i;
            i += size;
        });
        return cachedLayout = offsets;
    };

    var cachedOrderedLayout;
    this.getOrderedLayout = function() {
        if (cachedOrderedLayout) return cachedOrderedLayout;
        var order = getLayout().map(function(member) {
            return contentsTypeMap[member];
        });
        return cachedOrderedLayout = order;
    };

    var cachedLayoutIndices;
    this.getLayoutIndex = function(name) {
        if (cachedLayoutIndices) return cachedLayoutIndices[name];
        var layout = getLayout();
        var indices = {};
        layout.forEach(function(key, i) {
            indices[key] = i;
        });
        return (cachedLayoutIndices = indices)[name];
    };

    this.getSize = function() {
        var sum = 0;
        for (var key in this.contentsTypeMap) {
            sum += this.contentsTypeMap[key].getSize();
        }
        return sum;
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

    this.toString = function() {
        return this.typeName;
    };

    this.flatTypeName = function() {
        return 'struct$' + (this.__assignedName || this.typeName);
    };

    this.hasMethod = function(name) {
        return name in this.methods;
    };

    this.getMethod = function(name) {
        return this.methods[name];
    };

    this.getMethodType = function(name, ctx) {
        var temp = ctx.lookupFunctionByName(this.getMethod(name)).getType(ctx);
        temp.__isMethod = true;
        return temp;
    };

    this.hasMember = function(name) {
        return name in this.contentsTypeMap;
    };

    this.getMemberType = function(name) {
        return this.contentsTypeMap[name];
    };

    this.isSubscriptable = function() {
        return false;
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

    this.isSubscriptable = function() {
        return true;
    };

    this.getSubscriptType = function(index) {
        return this.contentsTypeArr[index];
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

    this.getReturnType = function() {
        return this.returnType;
    };

    this.getArgs = function() {
        return this.args;
    };

    this.getSize = function() {
        // This should return the size of a function reference.
        return 8; // 4 for functable index, 4 for pointer to context
    };

    this.isSubscriptable = function() {
        return false;
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

    this.hasMethod = function() {return false;};

    this.hasType = function(name) {
        return name in this.mod.exportTypes;
    };

    this.getTypeOf = function(name) {
        return this.mod.env.typeMap[this.mod.exportTypes[name]];
    };

    this.isSubscriptable = function() {
        return false;
    };

}

exports.Module = Module;


var public_ = exports.publicTypes = {
    'int': new Primitive('int', 'int32'),
    'float': new Primitive('float', 'float64'),
    'sfloat': new Primitive('sfloat', 'float32'),
    'bool': new Primitive('bool', 'uint8'),
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
