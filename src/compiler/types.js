var generatorNodes = require('./generators/nodes');

var Literal = generatorNodes.Literal;
var HeapLookup = generatorNodes.HeapLookup;
var Binop = generatorNodes.Binop;


var typeCache = {};
function getPrimitive(name) {
    return typeCache[name] || (typeCache[name] = new Type(name));
}

var Type = module.exports = function type(name, traits) {
    this.name = name;
    this.traits = traits || [];

    this.ghost = 'uint32';  // Pointer by default
    this.primitive = false;

    this.members = {};

    // Recursively apply type information for base type and all types that it
    // extends from.
    function apply(base) {
        if ('extend' in base) {
            apply.call(this, lookupType(base.extend));
        }
        for (var member in base.members) {
            this.members[member] = {
                type: base.memberTypes[member],
                generator: base.members[member]
            };
        }
        // Use a determined ghost type as the base if it's available, otherwise
        // use uint32 (pointer type).
        this.ghost = base.ghost || 'uint32';
        this.primitive = base.primitive || false;
        this.fullSize = base.fullSize || this.baseSize.bind(this);
    }
    apply.call(this, lookupType(name));

};

/*
This method is the pass-through to return the psoition of the content of an
instance. If a primitive type is invoked, the passed generated code is returned
unchanged. If a complex type is invoked, code to dereference the pointer at the
location passed is returned.
*/
Type.prototype.lookupContent = function(base) {
    if (this.primitive) return base;
    return HeapLookup({
        heap: 'ptrheap',
        pointer: base,
        offset: 0
    });
};

Type.prototype.getHeap = function() {
    return GHOST_TYPES[this.ghost].heap;
};

Type.prototype.baseSize = function() {
    return GHOST_TYPES[this.ghost].bytes;
};

Type.prototype.subscript = function(instance) {
};

Type.prototype.equals = function(type) {
    if (type.name !== this.name) return false;
    if (type.traits.length !== this.traits.length) return false;
    for (var i = 0; i < this.traits.length; i++) {
        if (!this.traits[i].equals(type.traits[i])) return false;
    }
    return true;
};

Type.prototype.toString = function() {
    return this.name + '<' + this.traits.map(function(trait) {
        return trait.toString();
    }).join(',') + '>';
};

/*
There are four classifications of types in BType:

- Ghost types
- Primitive types
- Included types
- Complex types

*/

var GHOST_TYPES = {
    int32: {
        bytes: 4,
        heap: 'intheap'
    },
    float64: {
        bytes: 8,
        heap: 'floatheap'
    },
    uint32: {  // Pointer type
        bytes: 4,
        heap: 'ptrheap'
    },
    uint8: {  // Normally for memory management, but also bools
        bytes: 1,
        heap: 'memheap'
    }
};

var PRIMITIVE_TYPES = {
    int: {
        ghost: 'int32',
        primitive: true,
        zeroVal: function() {
            return Literal({value: 0});
        }
    },
    _uint: {
        // Not exposed to the user directly
        ghost: 'uint32',
        primitive: true,
        extend: 'int',
        zeroVal: function() {
            return Literal({value: 0});
        }
    },
    _byte: {
        // Not exposed to the user directly
        ghost: 'uint8',
        primitive: true,
        extend: 'int',
        zeroVal: function() {
            return Literal({value: 0});
        }
    },
    float: {
        ghost: 'float64',
        primitive: true,
        zeroVal: function() {
            return Literal({value: 0.0});
        }
    },
    bool: {
        ghost: 'uint8',
        primitive: true,
        zeroVal: function() {
            return Literal({value: 0});
        }
    }
};

var INCLUDED_TYPES = {
    array: {
        memberTypes: {
            length: getPrimitive('_uint')
        },
        members: {
            length: function(ptr) {
                return HeapLookup({
                    heap: 'intheap',
                    pointer: ptr,
                    offset: Literal({value: 0})
                });
            }
        },
        subscriptType: function(instance) {
            return instance.traits[0];
        },
        subscript: function(instance, position) {
            // There is one integer at the head of the array. Skip the offset
            // beyond it and increment by the offset times the size of the
            // elements in the array.
            return HeapLookup({
                heap: 'intheap',
                pointer: ptr,
                offset: Binop({
                    left: Binop({
                        left: instance,
                        operator: '+',
                        right: Literal({value: 4})
                    }),
                    operator: '+',
                    right: Binop({
                        // Use the type of the subscript. This allows extension
                        // of the array type.
                        left: Literal({value: this.subscriptType().baseSize()}),
                        operator: '*',
                        right: position
                    })
                })
            });
        }
    },
    func: {
        call: function(instance, paramList) {

        }
    },
    funcctx: {},
    _module: {

    }
};

var COMPLEX_TYPES = {
    // Strings and static strings
    str: {
        extend: 'array',
        subscriptType: function(instance) {
            return getPrimitive('_uint');
        }
    },
    staticstr: {
        extend: 'str'
    },
    asciistr: {
        extend: 'str',
        subscriptType: function(instance) {
            return getPrimitive('_byte');
        }
    },
    staticasciistr: {
        extend: 'asciistr'
    }
};

function lookupType(name) {
    return (COMPLEX_TYPES && COMPLEX_TYPES[name]) ||
        (INCLUDED_TYPES && INCLUDED_TYPES[name]) ||
        (PRIMITIVE_TYPES && PRIMITIVE_TYPES[name]) || null;
}
