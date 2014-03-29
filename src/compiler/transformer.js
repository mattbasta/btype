var nodes = require('./nodes');
// var traverser = require('./traverser');

/*
The transformer is responsible for taking a collection of nested BType
functions and transforming them into a one-deep collection of functions. This
allows for compilation to many low-level target languages and allows memory to
be managed statically.

There are three types of operations:

1. Side Effect-Free: The function is upliftable to the global scope with no
   changes to its behavior. This may be done for any function which does not
   access any lexical scope.

   This is the simplest of the changes. Simply uplifting the function should
   work as expected.

2. Lexically Scoped, Internally Side Effect-Free: The function accesses lexical
   scope but it only reads those values. The function does not escape its
   parent scope's context.

   This is less simple than side effect-free functions. The function must be
   modified to accept lexically scoped variables as parameters and all function
   calls must be updated to pass those values.

    func int:foo(int:a) {
        func int:bar(int:b) {
            return a + b;
        }
        return bar(3);
    }

   The above example will produce the following pseudocode:

    function foo(a) {
        function bar(b, a) {
            return a + b;
        }
        return bar(3, a);
    }

   This is flattened as usual.

3. Lexically Scoped: The function accesses lexical scope and it either escapes
   its parent's context or it modifies lexically scoped variables. This is also
   used if the function is treated as a first-class function internally.

   The function must be modified to accept a context object as an argument. The
   context object contains all values that the function accesses externally.
   The shape of the context object is not unique per processed method but
   rather unique to the parent context. All functions that exist in the same
   context and access values in the lexical scope (regardless of which values
   are accessed) will share the same context object.

   Functions which access multiple lexical scopes (e.g.: the function accesses
   a variable in its parent's context, and one in its parent's parent's
   context) will force their parent to acccess its parent's lexical scope. The
   context object that the nested function will be passed will have been
   created by its parent and will in turn contain a reference to the context
   object of its own parent:

    func int:foo(int:a, int:b) {
        func int:bar(int:c) {
            func int:zip() {
                a = a + 1;
                return a + c;
            }
            return zip();
        }
        return bar(a + b);
    }

   The above example will produce the following pseudocode:

    function foo($a, $b) {
        var context = {a: $a};
        function bar(ctx, $c) {
            var context = {c: $c, parentCtx: ctx};
            function zip(ctx) {
                ctx.parentCtx.a = ctx.parentCtx.a + 1;
                return ctx.parentCtx.a + ctx.c;
            }
            return zip(context);
        }
        return bar(context, $a + $b);
    }

   This, in turn, is able to be flattened:

    function zip(ctx) {
        ctx.parentCtx.a = ctx.parentCtx.a + 1;
        return ctx.parentCtx.a + ctx.c;
    }
    function bar(ctx, $c) {
        return zip({c: $c, parentCtx: ctx});
    }
    function foo($a, $b) {
        return bar({a: $a}, $a + $b);
    }

   It is worth noting that if a function reads a value from it's parent's
   parent and writes to one in its parent, its parent does not need to force
   the grandparent to create a context object, and the variable from the
   grandparent may be passed via technique 2 to the parent.

   Note that any function (in the original example, the parent function) that
   is transformed to include a context object must then use the context object
   instead of creating a variable on the stack. Otherwise, the parent function
   will have out-of-sync data from its clients. Consequently, all references to
   the symbols moved into the context object must be rewritten to access the
   context object instead.

   Function parameters that are known to be accessed from the lexical scope
   should indeed be added to the context object shape and immediately
   initialized as such.

Performing the transformations for case #3 above requires the use of dynamic
memory allocation. Rather than implementing low-level calls, code is generated
that creates the context objects and performs memory management in the
application space. This allows the implementation to be more tightly integrated
with the compiler, enabling optimizations.

*/
var transform = module.exports = function(context) {
	var resultingFuncs = [];

    function processFunc(node, context) {
        //
    }

    function processContext(ctx, tree) {
        // Iterate over each child context.
        ctx.functions.forEach(function(funcNode) {
            processContext(funcNode.__context);
        });

        // Process this individual context's function.
        tree = tree || ctx.scope;
        processFunc(tree, ctx);
    }

    processContext(context);
};
