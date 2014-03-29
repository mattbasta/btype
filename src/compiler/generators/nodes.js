function nodeFactory(type, proto) {
    var output = function(base) {
        this.type = type;
        if ('validate' in this && !this.validate(base)) {
            throw new Error('Invalid generated node (' + type + ')');
        }
        for(var prop in base) {
            this[prop] = base[prop];
        }
    };
    if (proto) {
        for (var i in proto) {
            output.prototype[i] = proto[i];
        }
    }
    module.exports[type] = function(base) {
        return new output(base);
    };
}


// Expressions

nodeFactory(
    'Identifier',
    {
        validate: function(base) {
            return 'name' in base;
        }
    }
);

/*
A heap lookup is declared with a pointer and an offset. The offset is an
integer representing the number of bytes offset the value is from the beginning
of the data contained within the object allocated at the pointer. This means
that the offset does not include overhead from memory management or type
information. The pointer should be a raw calculation in generator node format.

It is the responsibility of the target generator to add additional operations
in order to resolve the offset to the proper location after the object
overhead, as well as to bitshift the value of the offset to the proper heap
index (the offset is specified in bytes, not words).
*/
nodeFactory(
    'HeapLookup',
    {
        validate: function(base) {
            return 'heap' in base && 'pointer' in base && 'offset' in base;
        }
    }
);

nodeFactory(
    'Literal',
    {
        validate: function(base) {
            return 'value' in base;
        }
    }
);

// Binops represent all binary operators, not just infix operators
// It's the responsibility of the target generator to convert these into the
// proper final operation.
nodeFactory(
    'Binop',
    {
        validate: function(base) {
            return ('operator' in base &&
                    'left' in base &&
                    'right' in base);
        }
    }
);

nodeFactory(
    'CallExpression',
    {
        validate: function(base) {
            return 'callee' in base && 'params' in base;
        }
    }
);

nodeFactory(
    'Allocate',
    {
        validate: function(base) {
            return 'type' in base && 'arguments' in base;
        }
    }
);


// Statements

nodeFactory(
    'StatementList',
    {
        validate: function(base) {
            return 'body' in base;
        }
    }
);

nodeFactory(
    'Assign',
    {
        validate: function(base) {
            return 'target' in base && 'value' in base;
        }
    }
);

nodeFactory(
    'Call',
    {
        validate: function(base) {
            return 'callee' in base && 'params' in base;
        }
    }
);
